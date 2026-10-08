/** Public synthetic profiles; passwords and PINs are for local teaching only. */
export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ name: "Cheng-Yang Lee", username: "chengyang.lee" }),
  Object.freeze({ name: "Gospelhope David", username: "gospelhope.david" }),
  Object.freeze({ name: "Mingyu Fan", username: "mingyu.fan" }),
]);

export const DEMO_ACCOUNT = Object.freeze({
  username: DEMO_ACCOUNTS[0].username,
  password: "HikyuDemo2026!",
  pin: "2468",
});
