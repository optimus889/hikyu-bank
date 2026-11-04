package hikyubank.web.controller;

import java.util.UUID;
import hikyubank.application.dto.BankDtos.*;
import hikyubank.application.model.Alert;
import hikyubank.application.service.AlertService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertService alerts;

    public AlertController(AlertService alerts) {
        this.alerts = alerts;
    }

    @GetMapping
    public List<Alert> list(
        @RequestAttribute("hikyu.userId") UUID userId
    ) {
        return alerts.list(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Alert create(
        @RequestAttribute("hikyu.userId") UUID userId,
        @Valid @RequestBody AlertRequest input
    ) {
        return alerts.create(userId, input);
    }

    @PatchMapping("/{id}")
    public Alert toggle(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id,
        @Valid @RequestBody ToggleAlertRequest input
    ) {
        return alerts.toggle(userId, id, input.enabled());
    }

    @PutMapping("/{id}")
    public Alert update(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id,
        @Valid @RequestBody AlertRequest input
    ) {
        return alerts.update(userId, id, input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id
    ) {
        alerts.remove(userId, id);
    }

}
