package hikyubank.web.error;
/** API errors are independent of the host OS, Accept-Language and validator locale. */
public final class ValidationMessages {
 private ValidationMessages() {}
 public static String forField(String field,String constraint) {
  String label=switch(field){case "recipientUsername","username"->"Username";case "pin","newPin"->"Card PIN";case "verificationCode","code"->"Verification code";case "currentPassword"->"Current password";case "newPassword"->"New password";case "password"->"Password";case "sourceAccountId"->"Source account";case "targetAccountId"->"Destination account";case "idempotencyKey"->"Request key";case "challengeId"->"Verification request";case "firstName"->"First name";case "lastName"->"Last name";case "name"->"Name";case "note"->"Note";case "method"->"Verification method";case "amount"->"Amount";default->"This field";};
  if("NotBlank".equals(constraint)||"NotNull".equals(constraint))return label+" is required.";
  if(field.equals("pin")||field.equals("newPin"))return "Enter exactly four digits for your card PIN.";
  if(field.equals("code")||field.equals("verificationCode"))return "Enter the six-digit verification code.";
  if(field.equals("username")||field.equals("recipientUsername"))return "Enter a lowercase username using letters, numbers, dots, underscores or hyphens. Example: gospelhope.david.";
  if(field.equals("amount"))return "Enter a positive amount with at most two decimal places, up to $1,000,000.";
  if(field.equals("note"))return "Keep your note within 250 characters.";
  if(field.toLowerCase(java.util.Locale.ROOT).contains("password"))return "Check the password length. New passwords must contain 12–72 characters.";
  if(field.equals("method"))return "Choose SMS or email verification.";
  return "Enter a valid value for "+label.toLowerCase(java.util.Locale.ROOT)+".";
 }
}
