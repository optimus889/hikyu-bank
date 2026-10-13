/** Do not display browser/OS-localized validationMessage strings. */
export function validationMessage(field) {
 const v=field.validity, label=field.labels?.[0]?.textContent?.trim().replace(/\s+/g," ") || field.name || "This field";
 if(v.valueMissing)return label+" is required.";
 if(v.patternMismatch){
  if(["pin","newPin","pinConfirmation"].includes(field.name))return "Enter exactly four digits for your card PIN.";
  if(["code","verificationCode"].includes(field.name)||field.classList?.contains("payment-code"))return "Enter the six-digit verification code.";
  if(["username","recipientUsername"].includes(field.name))return "Enter a lowercase username using letters, numbers, dots, underscores or hyphens. Example: gospelhope.david.";
  return "Check the format of "+label.toLowerCase()+".";
 }
 if(v.typeMismatch)return field.type==="email" ? "Enter a valid email address." : "Enter a valid value for "+label.toLowerCase()+".";
 if(v.badInput)return "Enter a valid number.";
 if(v.rangeUnderflow)return "Enter a value of at least "+field.min+".";
 if(v.rangeOverflow)return "Enter a value no greater than "+field.max+".";
 if(v.stepMismatch)return "Enter an amount with at most two decimal places.";
 if(v.tooShort)return "Enter at least "+field.minLength+" characters.";
 if(v.tooLong)return "Enter no more than "+field.maxLength+" characters.";
 return "Check "+label.toLowerCase()+" and try again.";
}
const installed=new WeakSet();
export function installEnglishValidation(root) {
 if(installed.has(root))return;installed.add(root);
 root.addEventListener("invalid",event=>{
  event.preventDefault();const field=event.target,form=field.form;
  // Browsers validate multiple controls; retain the first actionable error.
  if(form && form.querySelector(":invalid")!==field)return;
  let status=form?.querySelector('[role="alert"],.form-status,[role="status"]');
  if(!status){status=root.createElement("p");status.setAttribute("role","alert");status.className="form-status";(form||field.parentElement).append(status);}
  status.textContent=validationMessage(field);status.dataset.validationError="true";field.setAttribute("aria-invalid","true");field.focus();
 },true);
 root.addEventListener("input",event=>{
  const field=event.target;field.removeAttribute?.("aria-invalid");const form=field.form;
  form?.querySelectorAll('[data-validation-error="true"]').forEach(status=>{status.textContent="";delete status.dataset.validationError;});
 });
}
