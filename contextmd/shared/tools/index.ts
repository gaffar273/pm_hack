/**
 * Shared tools barrel — re-exports all shared tools so agents can import
 * from a single location.
 *
 * Usage in an agent:
 *   import { getPatientDemographics, getActiveMedications } from '../shared/tools/index.js';
 */

// Original FHIR tools from starter repo
export {
    getPatientDemographics,
    getActiveMedications,
    getActiveConditions,
    getRecentObservations,
    getCarePlans,
    getCareTeam,
    getGoals,
} from './fhir.js';

// ContextMD extended tools
export {
    getPatientHistory,
    getResult,
    getTrend,
    searchLiterature,
    checkDrugInteractions,
    getOpenFdaAdverseEvents,
} from './contextmd_tools.js';
