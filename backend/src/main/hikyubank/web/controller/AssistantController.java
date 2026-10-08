package hikyubank.web.controller;

import java.util.UUID;
import hikyubank.application.dto.BankDtos.*;
import hikyubank.application.service.AssistantService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/assistant")
public class AssistantController {
    private final AssistantService assistant;

    public AssistantController(AssistantService assistant) {
        this.assistant = assistant;
    }

    @PostMapping("/messages")
    public AssistantResponse ask(
        @RequestAttribute("hikyu.userId") UUID userId,
        @Valid @RequestBody AssistantRequest input
    ) {
        return assistant.ask(userId, input.message());
    }
}
