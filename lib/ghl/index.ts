/** GHL module — re-exports all GHL client functions */

export {
  getContact,
  updateContact,
  searchContacts,
  getContactHistory,
  getPipelines,
  searchOpportunities,
  movePipelineStage,
  getTasks,
  createTask,
  updateTask,
  createAppointment,
  getAppointments,
  sendMessage,
  getWorkflows,
  startAutomation,
  getNotes,
  addNote,
  GHLError,
} from "./client";
