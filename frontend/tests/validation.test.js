import test from "node:test";import assert from "node:assert/strict";
import { validationMessage } from "../js/components/validation.js";
function field(name,validity,extra={}) {return {name,validity,labels:[{textContent:name}],validationMessage:"需要匹配正则表达式",...extra};}
test("username errors use English guidance and never native localized text or regex",()=>{const s=validationMessage(field("recipientUsername",{patternMismatch:true}));assert.match(s,/lowercase username/);assert.match(s,/gospelhope.david/);assert.doesNotMatch(s,/[\u4e00-\u9fff]|\{2,79\}/);});
test("PIN and verification code have clear digit counts",()=>{assert.match(validationMessage(field("pin",{patternMismatch:true})),/four digits/);assert.match(validationMessage(field("code",{patternMismatch:true})),/six-digit/);});
test("required and amount precision errors remain English",()=>{assert.match(validationMessage(field("amount",{valueMissing:true})),/required/);assert.match(validationMessage(field("amount",{stepMismatch:true})),/two decimal/);});
test("range and length validation use field constraints",()=>{assert.match(validationMessage(field("amount",{rangeUnderflow:true},{min:"0.01"})),/0.01/);assert.match(validationMessage(field("password",{tooShort:true},{minLength:12})),/12/);});
