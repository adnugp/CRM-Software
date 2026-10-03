// Retired public server: use authenticated Firebase callables and emulators.
console.error('Legacy AI server disabled. Use Firebase callable aiChat/aiConfirm/aiIndexDocument. No HTTP, WebSocket, public upload or CRM data endpoint is exposed.');
process.exitCode = 1;
