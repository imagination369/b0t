import { createCircuitBreaker } from '@/lib/resilience';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * GoHighLevel (GHL) CRM Module
 *
 * Complete CRM and marketing automation platform integration
 * - Manage contacts, opportunities, and pipelines
 * - Send SMS and emails
 * - Create and manage appointments
 * - Tag management
 * - Trigger workflows
 * - Custom field operations
 * - Generic API access for any endpoint
 *
 * Perfect for:
 * - Lead management automation
 * - Sales pipeline workflows
 * - Customer communication
 * - Appointment scheduling
 * - Marketing automation
 * - CRM synchronization
 *
 * Rate Limits:
 * - Burst: 100 requests per 10 seconds
 * - Daily: 200,000 requests per day
 * - Monitored via X-RateLimit-* headers
 *
 * Authentication:
 * - OAuth 2.0 (access token valid 24h)
 * - Or API Key
 */

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

if (!GHL_API_KEY) {
  logger.warn('⚠️  GHL_API_KEY not set. GoHighLevel features will not work.');
}

// Rate limiter: GHL allows 100 req/10sec burst, 200k/day
// Conservative: 100 req/10sec = 10 req/sec = 1 req/100ms
const ghlRateLimiter = createRateLimiter({
  maxConcurrent: 5,
  minTime: 100, // 100ms between requests
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 10000, // 10 seconds
  id: 'gohighlevel',
});

// ============================================================================
// TYPES
// ============================================================================

export interface GHLContact {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  dateAdded?: string;
  dateUpdated?: string;
  [key: string]: unknown;
}

export interface GHLOpportunity {
  id: string;
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  monetaryValue?: number;
  status: string;
  contactId?: string;
  assignedTo?: string;
  [key: string]: unknown;
}

export interface GHLAppointment {
  id: string;
  locationId: string;
  contactId: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
  appointmentStatus?: string;
  [key: string]: unknown;
}

export interface GHLTag {
  id: string;
  name: string;
  locationId: string;
}

export interface GHLApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  locationId?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// ============================================================================
// INTERNAL HELPER: Make authenticated API request
// ============================================================================

async function makeGHLRequestInternal<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: unknown,
  params?: Record<string, unknown>,
  customHeaders?: Record<string, string>
): Promise<T> {
  if (!GHL_API_KEY) {
    throw new Error('GoHighLevel API key not configured. Set GHL_API_KEY.');
  }

  // Build URL with query params
  const url = new URL(`${GHL_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      ...customHeaders,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  logger.info({ method, endpoint, hasBody: !!body }, 'Making GHL API request');

  const response = await fetch(url.toString(), options);

  // Log rate limit headers for monitoring
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
  if (rateLimitRemaining || rateLimitLimit) {
    logger.debug(
      {
        remaining: rateLimitRemaining,
        limit: rateLimitLimit,
        endpoint
      },
      'GHL rate limit status'
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        endpoint
      },
      'GHL API request failed'
    );
    throw new Error(
      `GHL API error (${response.status}): ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  logger.info({ endpoint, status: response.status }, 'GHL API request successful');

  return data as T;
}

// Keep makeGHLRequest as simple helper (no wrapping at this level)
// Individual functions will be wrapped with circuit breaker + rate limiting
async function makeGHLRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: unknown,
  params?: Record<string, unknown>,
  customHeaders?: Record<string, string>
): Promise<T> {
  return makeGHLRequestInternal<T>(endpoint, method, body, params, customHeaders);
}

// ============================================================================
// GENERIC API REQUEST FUNCTION (for maximum flexibility)
// ============================================================================

/**
 * Generic API request - use for ANY GHL endpoint
 * This allows workflows to call any GHL API endpoint, even new/undocumented ones
 *
 * @example
 * // Custom endpoint call
 * await apiRequest({
 *   method: 'POST',
 *   endpoint: '/contacts/bulk-import',
 *   locationId: 'abc123',
 *   data: { contacts: [...] }
 * })
 */
export async function apiRequest<T = unknown>(
  config: GHLApiRequestConfig
): Promise<T> {
  const { method, endpoint, data, params, headers } = config;

  logger.info(
    { method, endpoint },
    'GHL generic API request'
  );

  return await makeGHLRequest<T>(
    endpoint,
    method,
    data,
    params,
    headers
  ) as T;
}

// ============================================================================
// CONTACTS
// ============================================================================

/**
 * Create a new contact
 */
async function createContactInternal(
  locationId: string,
  contactData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
    [key: string]: unknown;
  }
): Promise<GHLContact> {
  logger.info({ locationId, email: contactData.email }, 'Creating GHL contact');

  return makeGHLRequest<GHLContact>(
    '/contacts',
    'POST',
    { ...contactData, locationId }
  );
}

const createContactWithBreaker = createCircuitBreaker(createContactInternal, {
  timeout: 10000,
  name: 'ghl-create-contact',
});

const createContactRateLimited = withRateLimit(
  (locationId: string, contactData: Parameters<typeof createContactInternal>[1]) =>
    createContactWithBreaker.fire(locationId, contactData),
  ghlRateLimiter
);

export async function createContact(
  locationId: string,
  contactData: Parameters<typeof createContactInternal>[1]
): Promise<GHLContact> {
  return (await createContactRateLimited(locationId, contactData)) as unknown as GHLContact;
}

/**
 * Get contact by ID
 */
async function getContactInternal(
  locationId: string,
  contactId: string
): Promise<GHLContact> {
  logger.info({ locationId, contactId }, 'Getting GHL contact');

  return makeGHLRequest<GHLContact>(
    `/contacts/${contactId}`,
    'GET',
    undefined,
    { locationId }
  );
}

const getContactWithBreaker = createCircuitBreaker(getContactInternal, {
  timeout: 10000,
  name: 'ghl-get-contact',
});

const getContactRateLimited = withRateLimit(
  (locationId: string, contactId: string) =>
    getContactWithBreaker.fire(locationId, contactId),
  ghlRateLimiter
);

export async function getContact(
  locationId: string,
  contactId: string
): Promise<GHLContact> {
  return (await getContactRateLimited(locationId, contactId)) as unknown as GHLContact;
}

/**
 * Update contact
 */
async function updateContactInternal(
  locationId: string,
  contactId: string,
  updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    tags: string[];
    customFields: Record<string, unknown>;
    [key: string]: unknown;
  }>
): Promise<GHLContact> {
  logger.info({ locationId, contactId }, 'Updating GHL contact');

  return makeGHLRequest<GHLContact>(
    `/contacts/${contactId}`,
    'PUT',
    { ...updates, locationId }
  );
}

const updateContactWithBreaker = createCircuitBreaker(updateContactInternal, {
  timeout: 10000,
  name: 'ghl-update-contact',
});

const updateContactRateLimited = withRateLimit(
  (locationId: string, contactId: string, updates: Parameters<typeof updateContactInternal>[2]) =>
    updateContactWithBreaker.fire(locationId, contactId, updates),
  ghlRateLimiter
);

export async function updateContact(
  locationId: string,
  contactId: string,
  updates: Parameters<typeof updateContactInternal>[2]
): Promise<GHLContact> {
  return (await updateContactRateLimited(locationId, contactId, updates)) as unknown as GHLContact;
}

/**
 * Search/list contacts
 */
async function searchContactsInternal(
  locationId: string,
  filters?: {
    query?: string;
    email?: string;
    phone?: string;
    limit?: number;
    skip?: number;
    [key: string]: unknown;
  }
): Promise<{ contacts: GHLContact[]; total: number }> {
  logger.info({ locationId, filters }, 'Searching GHL contacts');

  return await makeGHLRequest<{ contacts: GHLContact[]; total: number }>(
    '/contacts',
    'GET',
    undefined,
    { locationId, ...filters }
  );
}

const searchContactsWithBreaker = createCircuitBreaker(searchContactsInternal, {
  timeout: 10000,
  name: 'ghl-search-contacts',
});

export const searchContacts = withRateLimit(
  (locationId: string, filters?: Parameters<typeof searchContactsInternal>[1]) =>
    searchContactsWithBreaker.fire(locationId, filters),
  ghlRateLimiter
);

/**
 * Delete contact
 */
async function deleteContactInternal(
  locationId: string,
  contactId: string
): Promise<{ success: boolean }> {
  logger.info({ locationId, contactId }, 'Deleting GHL contact');

  await makeGHLRequest(
    `/contacts/${contactId}`,
    'DELETE',
    undefined,
    { locationId }
  );

  return { success: true };
}

const deleteContactWithBreaker = createCircuitBreaker(deleteContactInternal, {
  timeout: 10000,
  name: 'ghl-delete-contact',
});

export const deleteContact = withRateLimit(
  (locationId: string, contactId: string) =>
    deleteContactWithBreaker.fire(locationId, contactId),
  ghlRateLimiter
);

// ============================================================================
// OPPORTUNITIES
// ============================================================================

/**
 * Create opportunity
 */
async function createOpportunityInternal(
  locationId: string,
  opportunityData: {
    pipelineId: string;
    pipelineStageId: string;
    name: string;
    monetaryValue?: number;
    contactId?: string;
    status?: string;
    assignedTo?: string;
    [key: string]: unknown;
  }
): Promise<GHLOpportunity> {
  logger.info({ locationId, name: opportunityData.name }, 'Creating GHL opportunity');

  return await makeGHLRequest<GHLOpportunity>(
    '/opportunities',
    'POST',
    { ...opportunityData, locationId }
  );
}

const createOpportunityWithBreaker = createCircuitBreaker(createOpportunityInternal, {
  timeout: 10000,
  name: 'ghl-create-opportunity',
});

export const createOpportunity = withRateLimit(
  (locationId: string, opportunityData: Parameters<typeof createOpportunityInternal>[1]) =>
    createOpportunityWithBreaker.fire(locationId, opportunityData),
  ghlRateLimiter
);

/**
 * Update opportunity
 */
async function updateOpportunityInternal(
  locationId: string,
  opportunityId: string,
  updates: Partial<{
    pipelineStageId: string;
    name: string;
    monetaryValue: number;
    status: string;
    assignedTo: string;
    [key: string]: unknown;
  }>
): Promise<GHLOpportunity> {
  logger.info({ locationId, opportunityId }, 'Updating GHL opportunity');

  return await makeGHLRequest<GHLOpportunity>(
    `/opportunities/${opportunityId}`,
    'PUT',
    { ...updates, locationId }
  );
}

const updateOpportunityWithBreaker = createCircuitBreaker(updateOpportunityInternal, {
  timeout: 10000,
  name: 'ghl-update-opportunity',
});

export const updateOpportunity = withRateLimit(
  (locationId: string, opportunityId: string, updates: Parameters<typeof updateOpportunityInternal>[2]) =>
    updateOpportunityWithBreaker.fire(locationId, opportunityId, updates),
  ghlRateLimiter
);

/**
 * List opportunities
 */
async function listOpportunitiesInternal(
  locationId: string,
  filters?: {
    pipelineId?: string;
    pipelineStageId?: string;
    assignedTo?: string;
    limit?: number;
    skip?: number;
    [key: string]: unknown;
  }
): Promise<{ opportunities: GHLOpportunity[]; total: number }> {
  logger.info({ locationId, filters }, 'Listing GHL opportunities');

  return await makeGHLRequest<{ opportunities: GHLOpportunity[]; total: number }>(
    '/opportunities',
    'GET',
    undefined,
    { locationId, ...filters }
  );
}

const listOpportunitiesWithBreaker = createCircuitBreaker(listOpportunitiesInternal, {
  timeout: 10000,
  name: 'ghl-list-opportunities',
});

export const listOpportunities = withRateLimit(
  (locationId: string, filters?: Parameters<typeof listOpportunitiesInternal>[1]) =>
    listOpportunitiesWithBreaker.fire(locationId, filters),
  ghlRateLimiter
);

// ============================================================================
// COMMUNICATION
// ============================================================================

/**
 * Send SMS to contact
 */
async function sendSMSInternal(
  locationId: string,
  contactId: string,
  message: string,
  options?: {
    mediaUrl?: string;
    [key: string]: unknown;
  }
): Promise<{ id: string; status: string }> {
  logger.info({ locationId, contactId, messageLength: message.length }, 'Sending SMS via GHL');

  return await makeGHLRequest<{ id: string; status: string }>(
    '/conversations/messages',
    'POST',
    {
      locationId,
      contactId,
      type: 'SMS',
      message,
      ...options,
    }
  );
}

const sendSMSWithBreaker = createCircuitBreaker(sendSMSInternal, {
  timeout: 10000,
  name: 'ghl-send-sms',
});

export const sendSMS = withRateLimit(
  (locationId: string, contactId: string, message: string, options?: Parameters<typeof sendSMSInternal>[3]) =>
    sendSMSWithBreaker.fire(locationId, contactId, message, options),
  ghlRateLimiter
);

/**
 * Send email to contact
 */
async function sendEmailInternal(
  locationId: string,
  contactId: string,
  emailData: {
    subject: string;
    body: string;
    fromEmail?: string;
    fromName?: string;
    attachments?: Array<{ url: string; name: string }>;
    [key: string]: unknown;
  }
): Promise<{ id: string; status: string }> {
  logger.info({ locationId, contactId, subject: emailData.subject }, 'Sending email via GHL');

  return await makeGHLRequest<{ id: string; status: string }>(
    '/conversations/messages',
    'POST',
    {
      locationId,
      contactId,
      type: 'Email',
      ...emailData,
    }
  );
}

const sendEmailWithBreaker = createCircuitBreaker(sendEmailInternal, {
  timeout: 10000,
  name: 'ghl-send-email',
});

export const sendEmail = withRateLimit(
  (locationId: string, contactId: string, emailData: Parameters<typeof sendEmailInternal>[2]) =>
    sendEmailWithBreaker.fire(locationId, contactId, emailData),
  ghlRateLimiter
);

// ============================================================================
// APPOINTMENTS
// ============================================================================

/**
 * Create appointment
 */
async function createAppointmentInternal(
  locationId: string,
  appointmentData: {
    calendarId: string;
    contactId: string;
    startTime: string; // ISO 8601
    endTime: string;   // ISO 8601
    title: string;
    notes?: string;
    assignedTo?: string;
    [key: string]: unknown;
  }
): Promise<GHLAppointment> {
  logger.info({ locationId, title: appointmentData.title }, 'Creating GHL appointment');

  return await makeGHLRequest<GHLAppointment>(
    '/appointments',
    'POST',
    { ...appointmentData, locationId }
  );
}

const createAppointmentWithBreaker = createCircuitBreaker(createAppointmentInternal, {
  timeout: 10000,
  name: 'ghl-create-appointment',
});

export const createAppointment = withRateLimit(
  (locationId: string, appointmentData: Parameters<typeof createAppointmentInternal>[1]) =>
    createAppointmentWithBreaker.fire(locationId, appointmentData),
  ghlRateLimiter
);

/**
 * List appointments
 */
async function listAppointmentsInternal(
  locationId: string,
  filters?: {
    contactId?: string;
    calendarId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    [key: string]: unknown;
  }
): Promise<{ appointments: GHLAppointment[]; total: number }> {
  logger.info({ locationId, filters }, 'Listing GHL appointments');

  return await makeGHLRequest<{ appointments: GHLAppointment[]; total: number }>(
    '/appointments',
    'GET',
    undefined,
    { locationId, ...filters }
  );
}

const listAppointmentsWithBreaker = createCircuitBreaker(listAppointmentsInternal, {
  timeout: 10000,
  name: 'ghl-list-appointments',
});

export const listAppointments = withRateLimit(
  (locationId: string, filters?: Parameters<typeof listAppointmentsInternal>[1]) =>
    listAppointmentsWithBreaker.fire(locationId, filters),
  ghlRateLimiter
);

// ============================================================================
// TAGS
// ============================================================================

/**
 * Get all tags for location
 */
async function getTagsInternal(locationId: string): Promise<{ tags: GHLTag[] }> {
  logger.info({ locationId }, 'Getting GHL tags');

  return await makeGHLRequest<{ tags: GHLTag[] }>(
    '/tags',
    'GET',
    undefined,
    { locationId }
  );
}

const getTagsWithBreaker = createCircuitBreaker(getTagsInternal, {
  timeout: 10000,
  name: 'ghl-get-tags',
});

export const getTags = withRateLimit(
  (locationId: string) => getTagsWithBreaker.fire(locationId),
  ghlRateLimiter
);

/**
 * Add tag to contact
 */
async function addTagToContactInternal(
  locationId: string,
  contactId: string,
  tagId: string
): Promise<{ success: boolean }> {
  logger.info({ locationId, contactId, tagId }, 'Adding tag to GHL contact');

  await makeGHLRequest(
    `/contacts/${contactId}/tags`,
    'POST',
    { tagId, locationId }
  );

  return { success: true };
}

const addTagToContactWithBreaker = createCircuitBreaker(addTagToContactInternal, {
  timeout: 10000,
  name: 'ghl-add-tag',
});

export const addTagToContact = withRateLimit(
  (locationId: string, contactId: string, tagId: string) =>
    addTagToContactWithBreaker.fire(locationId, contactId, tagId),
  ghlRateLimiter
);

/**
 * Remove tag from contact
 */
async function removeTagFromContactInternal(
  locationId: string,
  contactId: string,
  tagId: string
): Promise<{ success: boolean }> {
  logger.info({ locationId, contactId, tagId }, 'Removing tag from GHL contact');

  await makeGHLRequest(
    `/contacts/${contactId}/tags/${tagId}`,
    'DELETE',
    undefined,
    { locationId }
  );

  return { success: true };
}

const removeTagFromContactWithBreaker = createCircuitBreaker(removeTagFromContactInternal, {
  timeout: 10000,
  name: 'ghl-remove-tag',
});

export const removeTagFromContact = withRateLimit(
  (locationId: string, contactId: string, tagId: string) =>
    removeTagFromContactWithBreaker.fire(locationId, contactId, tagId),
  ghlRateLimiter
);

// ============================================================================
// CUSTOM FIELDS
// ============================================================================

/**
 * Update custom field value for contact
 */
async function updateCustomFieldInternal(
  locationId: string,
  contactId: string,
  fieldId: string,
  value: unknown
): Promise<{ success: boolean }> {
  logger.info({ locationId, contactId, fieldId }, 'Updating GHL custom field');

  await makeGHLRequest(
    `/contacts/${contactId}/customFields`,
    'PUT',
    { locationId, customFields: { [fieldId]: value } }
  );

  return { success: true };
}

const updateCustomFieldWithBreaker = createCircuitBreaker(updateCustomFieldInternal, {
  timeout: 10000,
  name: 'ghl-update-custom-field',
});

export const updateCustomField = withRateLimit(
  (locationId: string, contactId: string, fieldId: string, value: unknown) =>
    updateCustomFieldWithBreaker.fire(locationId, contactId, fieldId, value),
  ghlRateLimiter
);

// ============================================================================
// WORKFLOWS
// ============================================================================

/**
 * Trigger a workflow for a contact
 */
async function triggerWorkflowInternal(
  locationId: string,
  workflowId: string,
  contactId: string,
  eventData?: Record<string, unknown>
): Promise<{ success: boolean; executionId?: string }> {
  logger.info({ locationId, workflowId, contactId }, 'Triggering GHL workflow');

  const result = await makeGHLRequest<{ success: boolean; executionId?: string }>(
    `/workflows/${workflowId}/trigger`,
    'POST',
    {
      locationId,
      contactId,
      eventData,
    }
  );

  return result;
}

const triggerWorkflowWithBreaker = createCircuitBreaker(triggerWorkflowInternal, {
  timeout: 10000,
  name: 'ghl-trigger-workflow',
});

export const triggerWorkflow = withRateLimit(
  (locationId: string, workflowId: string, contactId: string, eventData?: Record<string, unknown>) =>
    triggerWorkflowWithBreaker.fire(locationId, workflowId, contactId, eventData),
  ghlRateLimiter
);
