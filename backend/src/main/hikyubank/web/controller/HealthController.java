package hikyubank.web.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public HealthController(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/v1/health")
    public HealthResponse health() {
        jdbc.queryForObject("SELECT 1", Integer.class);
        return new HealthResponse("UP", "postgresql", true);
    }

    public record HealthResponse(String status, String storage, boolean demo) {}
}
