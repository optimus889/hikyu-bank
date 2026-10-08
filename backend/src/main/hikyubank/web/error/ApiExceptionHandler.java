package hikyubank.web.error;

import hikyubank.application.exception.BankException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(BankException.class)
    public ResponseEntity<ApiError> applicationError(BankException error) {
        return ResponseEntity.status(error.status())
            .body(new ApiError(error.code(), error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validationError(MethodArgumentNotValidException error) {
        var first = error.getBindingResult().getFieldErrors().get(0);
        String message = first.getField() + ": " + first.getDefaultMessage();
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> invalidJson(HttpMessageNotReadableException error) {
        return ResponseEntity.badRequest().body(new ApiError(
            "INVALID_JSON", "Provide a valid JSON request body."
        ));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> integrityError(
        org.springframework.dao.DataIntegrityViolationException error
    ) {
        String detail = error.getMostSpecificCause().getMessage();
        if (detail != null && detail.contains("one_open_account_per_user_type")) {
            return ResponseEntity.status(409).body(new ApiError(
                "ACCOUNT_ALREADY_OPEN", "You have already opened this account."
            ));
        }
        return ResponseEntity.status(409).body(new ApiError(
            "DATA_CONFLICT", "The change conflicts with an existing record or data rule."
        ));
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<ApiError> databaseError(
        org.springframework.dao.DataAccessException error
    ) {
        return ResponseEntity.status(503).body(new ApiError(
            "DATABASE_UNAVAILABLE", "The database is temporarily unavailable. Please retry."
        ));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> invalidResourceId(Exception error) {
        return ResponseEntity.badRequest().body(new ApiError(
            "INVALID_RESOURCE_ID", "Provide a valid UUID resource identifier."
        ));
    }

    public record ApiError(String code, String message) {}
}
