/** GHL module — re-exports all GHL client functions + custom field resolver */

export { resolveFieldId, resolveCustomFields, refreshFieldCache, ensureCustomField } from "./custom-fields";

export {
  getContact,
  updateContact,
  upsertContact,
  searchContacts,
  getContactHistory,
  getPipelines,
  searchOpportunities,
  searchOpportunitiesPaginated,
  countContactsByFilter,
  countOpportunitiesByStatus,
  getStageIdByName,
  movePipelineStage,
  createOpportunity,
  getTasks,
  searchTasks,
  createTask,
  updateTask,
  getCalendars,
  createAppointment,
  updateAppointment,
  getAppointments,
  getAllAppointments,
  getFreeSlots,
  getConversations,
  getConversationMessages,
  markConversationRead,
  getCallRecording,
  getCallTranscription,
  sendMessage,
  triggerWorkflow,
  getNotes,
  addNote,
  getCustomFieldDefinitions,
  GHLError,
} from "./client";

export type { GHLCustomFieldDefinition } from "./client";
