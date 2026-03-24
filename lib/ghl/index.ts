/** GHL module — re-exports all GHL client functions */

export {
  getContact,
  updateContact,
  searchContacts,
  getContactHistory,
  getPipelines,
  searchOpportunities,
  getStageIdByName,
  movePipelineStage,
  getTasks,
  createTask,
  updateTask,
  getCalendarFreeSlots,
  createAppointment,
  getAppointments,
  sendMessage,
  getWorkflows,
  triggerWorkflow,
  getNotes,
  addNote,
  GHLError,
} from "./client";
