package hikyubank;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.junit.jupiter.api.Assertions.*;

/** Real controller -> service -> repository -> storage integration tests. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(BankApiIntegrationTest.ClockConfiguration.class)
class BankApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired hikyubank.dataaccess.repository.DemoUserRepository users;
    @Autowired hikyubank.dataaccess.repository.AccountRepository accounts;
    @Autowired hikyubank.dataaccess.repository.AlertRepository alerts;
    @Autowired hikyubank.dataaccess.repository.NotificationRepository notifications;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        String url = System.getenv("HIKYU_TEST_DB_URL");
        if (url == null || !url.matches("jdbc:postgresql://[^/]+/hikyu_bank_test(?:\\?.*)?")) {
            throw new IllegalStateException(
                "Use a dedicated hikyu_bank_test database; set HIKYU_TEST_DB_URL."
            );
        }
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () ->
            System.getenv().getOrDefault("HIKYU_TEST_DB_USER", "hikyu"));
        properties.add("spring.datasource.password", () ->
            System.getenv().getOrDefault("HIKYU_TEST_DB_PASSWORD", "hikyu_local_demo"));
        properties.add("hikyu.demo.seed-enabled", () -> true);
    }

    @BeforeEach
    void resetClock() {
        clock.reset();
    }

    @Test
    void protectedEndpointsRejectAnonymousRequests() throws Exception {
        for (String path : new String[]{"accounts", "transactions", "alerts", "notifications"}) {
            var result = call("GET", "/" + path, null, new MockHttpSession());
            assertEquals(401, result.getResponse().getStatus());
        }
        assertEquals(200, call("GET", "/health", null, null).getResponse().getStatus());
    }

    @Test
    void writesRequireApplicationHeader() throws Exception {
        var result = mvc.perform(MockMvcRequestBuilders.post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(credentials()))).andReturn();
        assertEquals(403, result.getResponse().getStatus());
    }

    @Test
    void smsVerificationCreatesSessionAndConsumesChallenge() throws Exception {
        var session = new MockHttpSession();
        var challenge = json(call("POST", "/auth/login", credentials(), session));
        var code = requestCode(session, challenge, "sms");
        var payload = verification(challenge, code, "sms", "");
        assertEquals(200, call("POST", "/auth/verify", payload, session).getResponse().getStatus());
        var profile = json(call("GET", "/auth/session", null, session));
        assertEquals("Cheng-Yang Lee", profile.path("user").path("name").asText());
        assertEquals("Lee", profile.path("user").path("lastName").asText());
        var replay = call("POST", "/auth/verify", payload, session);
        assertEquals("CHALLENGE_INVALID", json(replay).path("code").asText());
    }

    @Test
    void emailVerificationRequiresCorrectFourDigitPin() throws Exception {
        var session = new MockHttpSession();
        var challenge = json(call("POST", "/auth/login", credentials(), session));
        var code = requestCode(session, challenge, "email");
        var invalid = call("POST", "/auth/verify", verification(challenge, code, "email", "0000"), session);
        assertEquals(400, invalid.getResponse().getStatus());
        assertEquals(401, call("GET", "/accounts", null, session).getResponse().getStatus());
        var valid = call("POST", "/auth/verify", verification(challenge, code, "email", "2468"), session);
        assertEquals(200, valid.getResponse().getStatus());
    }

    @Test
    void duplicateCheckingAndSavingsAreRejectedOnServer() throws Exception {
        var session = signedIn();
        for (String type : new String[]{"checking", "savings"}) {
            var result = call("POST", "/accounts", Map.of("type", type, "name", "Another nickname"), session);
            assertEquals(409, result.getResponse().getStatus());
            assertEquals("ACCOUNT_ALREADY_OPEN", json(result).path("code").asText());
        }
        var products = json(call("GET", "/accounts/products", null, session));
        assertTrue(products.get(0).path("alreadyOpen").asBoolean());
        assertTrue(products.get(1).path("alreadyOpen").asBoolean());
        assertFalse(products.get(3).path("alreadyOpen").asBoolean());
    }

    @Test
    void loanApplicationStaysPendingAndCanBeReadBack() throws Exception {
        var session = signedIn();
        var result = call("POST", "/accounts", Map.of("type", "loan", "name", "Study loan"), session);
        assertEquals(201, result.getResponse().getStatus());
        var account = json(result);
        assertEquals("pending", account.path("status").asText());
        var stored = json(call("GET", "/accounts/" + account.path("id").asText(), null, session));
        assertEquals("Study loan", stored.path("name").asText());
    }

    @Test
    void transactionFilteringAndAssistantUseServerData() throws Exception {
        var session = signedIn();
        var items = json(call("GET", "/transactions?accountId=" + leeAccount("credit"), null, session));
        assertEquals(7, items.size());
        for (var item : items) {
            assertEquals(leeAccount("credit"), item.path("accountId").asText());
        }
        var reply = json(call("POST", "/assistant/messages", Map.of("message", "biggest spending category"), session));
        assertTrue(reply.path("reply").asText().contains("$1,929.30"));
        assertTrue(reply.path("reply").asText().contains("Housing"));
        assertEquals("rule-based-demo", reply.path("mode").asText());
    }

    @Test
    void validatesAlertAmountsDatesAndAccountReferences() throws Exception {
        var session = signedIn();
        var invalidAmount = Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "Balance",
            "channel", "Email", "amount", -5
        );
        assertEquals(400, call("POST", "/alerts", invalidAmount, session).getResponse().getStatus());
        var invalidDate = Map.of(
            "type", "scheduled", "accountId", leeAccount("checking"), "title", "Bill",
            "channel", "SMS", "date", "2026-02-30"
        );
        assertEquals(400, call("POST", "/alerts", invalidDate, session).getResponse().getStatus());
        var unknownAccount = Map.of(
            "type", "low_balance", "accountId", java.util.UUID.randomUUID().toString(), "title", "Balance",
            "channel", "Email", "amount", 100
        );
        assertEquals(404, call("POST", "/alerts", unknownAccount, session).getResponse().getStatus());
    }

    @Test
    void alertInboxLifecycleIsStoredOnBackend() throws Exception {
        var session = signedIn();
        var alert = json(call("POST", "/alerts", Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "Check balance",
            "channel", "In-app", "amount", 100
        ), session));
        String alertId = alert.path("id").asText();
        call("PATCH", "/alerts/" + alertId, Map.of("enabled", false), session);
        assertEquals(409, call("POST", "/notifications/test", Map.of("alertId", alertId), session)
            .getResponse().getStatus());
        call("PATCH", "/alerts/" + alertId, Map.of("enabled", true), session);
        var notification = json(call("POST", "/notifications/test", Map.of("alertId", alertId), session));
        String id = notification.path("id").asText();
        assertFalse(notification.path("read").asBoolean());
        var resolved = json(call("PATCH", "/notifications/" + id, Map.of("resolved", true), session));
        assertTrue(resolved.path("read").asBoolean());
        assertTrue(resolved.path("resolved").asBoolean());
        assertEquals(204, call("PATCH", "/notifications/read-all", Map.of(), session).getResponse().getStatus());
        assertEquals(204, call("DELETE", "/notifications/" + id, null, session).getResponse().getStatus());
        assertEquals(1, json(call("GET", "/notifications", null, session)).size());
    }

    @Test
    void codeAndSessionExpiryAreEnforcedOnServer() throws Exception {
        var session = new MockHttpSession();
        var challenge = json(call("POST", "/auth/login", credentials(), session));
        var code = requestCode(session, challenge, "sms");
        clock.advance(300_001);
        var expired = call("POST", "/auth/verify", verification(challenge, code, "sms", ""), session);
        assertEquals("CODE_EXPIRED", json(expired).path("code").asText());
        session = signedIn();
        clock.advance(1_800_001);
        assertEquals(401, call("GET", "/accounts", null, session).getResponse().getStatus());
    }

    @Test
    void resendAndFailedVerificationAttemptsAreLimited() throws Exception {
        var session = new MockHttpSession();
        var challenge = json(call("POST", "/auth/login", credentials(), session));
        var code = requestCode(session, challenge, "sms");
        var resend = call("POST", "/auth/code", Map.of(
            "challengeId", challenge.path("challengeId").asText(), "method", "sms"
        ), session);
        assertEquals(429, resend.getResponse().getStatus());
        String wrongCode = code.path("demoCode").asText().equals("000000") ? "111111" : "000000";
        var invalid = Map.of(
            "challengeId", challenge.path("challengeId").asText(), "method", "sms", "code", wrongCode
        );
        for (int attempt = 0; attempt < 5; attempt++) {
            call("POST", "/auth/verify", invalid, session);
        }
        var locked = call("POST", "/auth/verify", verification(challenge, code, "sms", ""), session);
        assertEquals("ATTEMPTS_EXCEEDED", json(locked).path("code").asText());
    }

    @Test
    void logoutInvalidatesSessionAndUiAssetsAreServed() throws Exception {
        var session = signedIn();
        assertEquals(204, call("POST", "/auth/logout", Map.of(), session).getResponse().getStatus());
        assertTrue(session.isInvalid());
        assertEquals(401, call("GET", "/accounts", null, new MockHttpSession()).getResponse().getStatus());
        var page = mvc.perform(MockMvcRequestBuilders.get("/login.html")).andReturn();
        assertEquals(200, page.getResponse().getStatus());
        assertTrue(page.getResponse().getContentAsString().contains("auth/login-page.js"));
    }

    @Test
    void threeProfilesHaveDistinctDataAndServerDerivedNames() throws Exception {
        String[] usernames = {"chengyang.lee", "gospelhope.david", "mingyu.fan"};
        String[] names = {"Cheng-Yang Lee", "Gospelhope David", "Mingyu Fan"};
        double[] balances = {8240.20, 6592.16, 9888.24};
        for (int index = 0; index < usernames.length; index++) {
            var session = signedIn(usernames[index]);
            var profile = json(call("GET", "/auth/session", null, session)).path("user");
            assertEquals(names[index], profile.path("name").asText());
            var accounts = json(call("GET", "/accounts", null, session));
            assertEquals(3, accounts.size());
            for (var account : accounts) {
                if (account.path("type").asText().equals("checking")) {
                    assertEquals(balances[index], account.path("balance").asDouble(), 0.001);
                }
            }
            assertEquals(12, json(call("GET", "/transactions", null, session)).size());
        }
    }

    @Test
    void accountTransactionAlertAndNotificationIdsCannotCrossOwners() throws Exception {
        var session = signedIn("mingyu.fan");
        assertEquals(404, call("GET", "/accounts/" + leeAccount("checking"), null, session).getResponse().getStatus());
        assertEquals(404, call("GET", "/transactions?accountId=" + leeAccount("credit"), null, session)
            .getResponse().getStatus());
        assertEquals(404, call("PATCH", "/alerts/" + leeAlert(), Map.of("enabled", false), session)
            .getResponse().getStatus());
        assertEquals(404, call("DELETE", "/alerts/" + leeAlert(), null, session).getResponse().getStatus());
        assertEquals(404, call("PATCH", "/notifications/" + leeNotification(), Map.of("read", true), session)
            .getResponse().getStatus());
        assertEquals(404, call("DELETE", "/notifications/" + leeNotification(), null, session)
            .getResponse().getStatus());
        assertEquals(404, call("POST", "/notifications/test", Map.of("alertId", leeAlert()), session)
            .getResponse().getStatus());
        assertEquals(404, call("POST", "/alerts", Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "Foreign account",
            "channel", "In-app", "amount", 100
        ), session).getResponse().getStatus());
        assertFalse(json(call("GET", "/notifications", null, signedIn()))
            .get(0).path("read").asBoolean());
    }

    @Test
    void alertCrudHasStableIdsAndProtectsLinkedNotifications() throws Exception {
        var session = signedIn();
        var input = Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "First title",
            "channel", "In-app", "amount", 100
        );
        var result = call("POST", "/alerts", input, session);
        assertEquals(201, result.getResponse().getStatus());
        String id = json(result).path("id").asText();
        var updated = json(call("PUT", "/alerts/" + id, Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "Updated title",
            "channel", "Email", "amount", 200
        ), session));
        assertEquals(id, updated.path("id").asText());
        assertEquals("Updated title", updated.path("title").asText());
        assertEquals(200, updated.path("amount").asInt());
        var other = signedIn("gospelhope.david");
        assertEquals(404, call("PUT", "/alerts/" + id, input, other).getResponse().getStatus());
        var notification = json(call("POST", "/notifications/test", Map.of("alertId", id), session));
        assertEquals(409, call("DELETE", "/alerts/" + id, null, session).getResponse().getStatus());
        call("DELETE", "/notifications/" + notification.path("id").asText(), null, session);
        assertEquals(204, call("DELETE", "/alerts/" + id, null, session).getResponse().getStatus());
        assertEquals(404, call("PATCH", "/alerts/" + id, Map.of("enabled", true), session)
            .getResponse().getStatus());
    }

    @Test
    void markAllReadAndAssistantStayWithinCurrentProfile() throws Exception {
        var fan = signedIn("mingyu.fan");
        call("PATCH", "/notifications/read-all", Map.of(), fan);
        assertTrue(json(call("GET", "/notifications", null, fan)).get(0).path("read").asBoolean());
        var lee = signedIn();
        assertFalse(json(call("GET", "/notifications", null, lee)).get(0).path("read").asBoolean());
        var leeReply = json(call("POST", "/assistant/messages", Map.of("message", "spending"), lee));
        var fanReply = json(call("POST", "/assistant/messages", Map.of("message", "spending"), fan));
        assertNotEquals(leeReply.path("reply").asText(), fanReply.path("reply").asText());
    }

    @Test
    void malformedUuidIsRejectedBeforeSql() throws Exception {
        var session = signedIn("mingyu.fan");
        String injected = "checking'),TRUE(),('";
        String id = java.net.URLEncoder.encode(injected, java.nio.charset.StandardCharsets.UTF_8);
        assertEquals(400, call("GET", "/transactions?accountId=" + id, null, session)
            .getResponse().getStatus());
    }

    @Test
    void changingAlertTypeClearsOldAmountOrDateInPostgresStorage() throws Exception {
        var session = signedIn();
        var alert = json(call("POST", "/alerts", Map.of(
            "type", "scheduled", "accountId", leeAccount("checking"), "title", "Date reminder",
            "channel", "In-app", "date", "2026-12-01"
        ), session));
        String id = alert.path("id").asText();
        call("PUT", "/alerts/" + id, Map.of(
            "type", "low_balance", "accountId", leeAccount("checking"), "title", "Amount reminder",
            "channel", "In-app", "amount", 100
        ), session);
        var items = json(call("GET", "/alerts", null, session));
        for (var item : items) {
            if (item.path("id").asText().equals(id)) {
                assertFalse(item.hasNonNull("date"));
                assertEquals(100, item.path("amount").asInt());
            }
        }
        call("PUT", "/alerts/" + id, Map.of(
            "type", "scheduled", "accountId", leeAccount("checking"), "title", "Date again",
            "channel", "In-app", "date", "2026-12-02"
        ), session);
        items = json(call("GET", "/alerts", null, session));
        for (var item : items) {
            if (item.path("id").asText().equals(id)) {
                assertFalse(item.hasNonNull("amount"));
                assertEquals("2026-12-02", item.path("date").asText());
            }
        }
    }

    private java.util.UUID leeId() {
        return users.findByUsername("chengyang.lee").orElseThrow().id();
    }

    private String leeAccount(String type) {
        return accounts.findAll(leeId()).stream()
            .filter(account -> account.type().equals(type)).findFirst().orElseThrow().id().toString();
    }

    private String leeAlert() {
        return alerts.findAll(leeId()).get(0).id().toString();
    }

    private String leeNotification() {
        return notifications.findAll(leeId()).get(0).id().toString();
    }

    @Test
    void apiResourceIdsAreUuidAndUnknownUuidRemains404() throws Exception {
        var session = signedIn();
        for (var account : json(call("GET", "/accounts", null, session))) {
            assertDoesNotThrow(() -> java.util.UUID.fromString(account.path("id").asText()));
        }
        assertEquals(404, call("GET", "/accounts/" + java.util.UUID.randomUUID(), null, session)
            .getResponse().getStatus());
        assertEquals(400, call("GET", "/accounts/not-a-uuid", null, session)
            .getResponse().getStatus());
    }

    private MockHttpSession signedIn() throws Exception {
        return signedIn("chengyang.lee");
    }

    private MockHttpSession signedIn(String username) throws Exception {
        var session = new MockHttpSession();
        var challenge = json(call("POST", "/auth/login",
            Map.of("username", username, "password", "HikyuDemo2026!"), session));
        var code = requestCode(session, challenge, "sms");
        var result = call("POST", "/auth/verify", verification(challenge, code, "sms", ""), session);
        assertEquals(200, result.getResponse().getStatus());
        return session;
    }

    private Map<String, String> credentials() {
        return Map.of("username", "chengyang.lee", "password", "HikyuDemo2026!");
    }

    private JsonNode requestCode(MockHttpSession session, JsonNode challenge, String method) throws Exception {
        return json(call("POST", "/auth/code", Map.of(
            "challengeId", challenge.path("challengeId").asText(), "method", method
        ), session));
    }

    private Map<String, String> verification(JsonNode challenge, JsonNode code, String method, String pin) {
        return Map.of(
            "challengeId", challenge.path("challengeId").asText(),
            "method", method, "code", code.path("demoCode").asText(), "pin", pin
        );
    }

    private MvcResult call(String method, String path, Object body, MockHttpSession session) throws Exception {
        var request = MockMvcRequestBuilders.request(
            org.springframework.http.HttpMethod.valueOf(method), "/api/v1" + path
        ).header("X-Hikyu-Request", "web").contentType(MediaType.APPLICATION_JSON);
        if (session != null) {
            request.session(session);
        }
        if (body != null) {
            request.content(mapper.writeValueAsString(body));
        }
        return mvc.perform(request).andReturn();
    }

    private JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    @TestConfiguration
    static class ClockConfiguration {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    static final class MutableClock extends Clock {
        private final AtomicLong now = new AtomicLong();

        void reset() {
            now.set(Instant.parse("2026-09-29T12:00:00Z").toEpochMilli());
        }

        void advance(long milliseconds) {
            now.addAndGet(milliseconds);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(now.get());
        }
    }
}
