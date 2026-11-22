/**
 * CALLORIA v7.16 — explicit digital customer-wait state counts.
 * These metrics distinguish an active thread awaiting a customer reply from
 * a CRM case that was dispositioned as pending customer information.
 */
export function digitalCustomerStateMetrics(items, DIGITAL_STATUS) {
  const rows = Array.isArray(items) ? items : [];
  const awaitingStatus = DIGITAL_STATUS?.AWAITING_CUSTOMER;
  const pendingStatus = DIGITAL_STATUS?.PENDING_CUSTOMER;

  return {
    awaitingCustomer: rows.reduce((count, item) =>
      count + (item && typeof item === 'object' && item.status === awaitingStatus ? 1 : 0), 0),
    pendingCustomerCases: rows.reduce((count, item) =>
      count + (item && typeof item === 'object' && item.status === pendingStatus ? 1 : 0), 0)
  };
}
