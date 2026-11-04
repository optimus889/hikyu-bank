package hikyubank.application.exception;

/** Application error independent of HTTP and storage implementation. */
public class BankException extends RuntimeException {
    private final String code;
    private final int status;

    public BankException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public String code() {
        return code;
    }

    public int status() {
        return status;
    }
}
