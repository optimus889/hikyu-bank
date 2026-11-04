package hikyubank.web.controller;

import java.util.UUID;
import hikyubank.application.dto.BankDtos.*;
import hikyubank.application.model.Notification;
import hikyubank.application.service.NotificationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<Notification> list(
        @RequestAttribute("hikyu.userId") UUID userId
    ) {
        return notifications.list(userId);
    }

    @PatchMapping("/{id}")
    public Notification update(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id,
        @Valid @RequestBody NotificationUpdate input
    ) {
        return notifications.update(userId, id, input);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(
        @RequestAttribute("hikyu.userId") UUID userId
    ) {
        notifications.markAllRead(userId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id
    ) {
        notifications.remove(userId, id);
    }

    @PostMapping("/test")
    @ResponseStatus(HttpStatus.CREATED)
    public Notification createTest(
        @RequestAttribute("hikyu.userId") UUID userId,
        @RequestBody TestNotificationRequest input
    ) {
        return notifications.createTest(userId, input.alertId());
    }
}
