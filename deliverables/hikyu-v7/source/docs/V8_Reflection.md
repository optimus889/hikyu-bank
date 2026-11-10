# V8 Reflection

Prompt engineering improved this update by turning broad UI goals into explicit compatibility constraints. The initial prompts named the existing Saltcorn views, POST fields, role checks, length limits and unavailable workflow history. This helped generate components that reused the application instead of inventing a new workflow or presenting unsupported stage history.

Testing remained essential. The first browser iterations exposed lost keyboard focus after a successful card update. A follow-up improved focus movement, but refresh still failed because disabling the button erased focus before it was captured. A further prompt identified that ordering problem and required preserving intentional user focus. The final browser suite passed this check alongside validation, input retention, filtering and stale-response protection.

The process made code review more concrete: each revision had a recorded requirement and observable evidence. It also showed that model output needs integration knowledge, such as Saltcorn's copied plugin modules and CSRF redirects. I did not measure productivity gains or complete a live Zapier integration. The remaining limits are documented rather than hidden behind successful local tests.
