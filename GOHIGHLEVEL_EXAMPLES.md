# GoHighLevel Module - Workflow Examples

The GoHighLevel module is now fully integrated into b0t! Here are examples of how to use it in workflows.

## Module Location
- **Category**: `business`
- **Module**: `gohighlevel`
- **Path in workflows**: `business.gohighlevel.functionName`

## Example Workflows

### 1. Simple Contact Creation

```json
{
  "version": "1.0",
  "name": "Create GHL Contact",
  "config": {
    "steps": [
      {
        "id": "create_contact",
        "module": "business.gohighlevel.createContact",
        "inputs": {
          "locationId": "your-location-id",
          "contactData": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com",
            "phone": "+1234567890",
            "tags": ["lead", "website"]
          }
        },
        "outputAs": "contact"
      },
      {
        "id": "send_welcome",
        "module": "business.gohighlevel.sendSMS",
        "inputs": {
          "locationId": "your-location-id",
          "contactId": "{{contact.id}}",
          "message": "Welcome to our service, {{contact.firstName}}!"
        }
      }
    ]
  }
}
```

### 2. Lead Generation with Opportunity Creation

```json
{
  "version": "1.0",
  "name": "Process New Lead",
  "config": {
    "steps": [
      {
        "id": "search_existing",
        "module": "business.gohighlevel.searchContacts",
        "inputs": {
          "locationId": "your-location-id",
          "filters": {
            "email": "{{trigger.email}}"
          }
        },
        "outputAs": "existing"
      },
      {
        "id": "create_if_new",
        "module": "business.gohighlevel.createContact",
        "inputs": {
          "locationId": "your-location-id",
          "contactData": {
            "firstName": "{{trigger.firstName}}",
            "lastName": "{{trigger.lastName}}",
            "email": "{{trigger.email}}",
            "phone": "{{trigger.phone}}"
          }
        },
        "outputAs": "contact"
      },
      {
        "id": "create_opportunity",
        "module": "business.gohighlevel.createOpportunity",
        "inputs": {
          "locationId": "your-location-id",
          "opportunityData": {
            "pipelineId": "your-pipeline-id",
            "pipelineStageId": "your-stage-id",
            "name": "Lead from {{trigger.source}}",
            "monetaryValue": 500,
            "contactId": "{{contact.id}}",
            "status": "open"
          }
        },
        "outputAs": "opportunity"
      }
    ]
  }
}
```

### 3. Appointment Booking Workflow

```json
{
  "version": "1.0",
  "name": "Book Appointment and Send Confirmation",
  "config": {
    "steps": [
      {
        "id": "create_appointment",
        "module": "business.gohighlevel.createAppointment",
        "inputs": {
          "locationId": "your-location-id",
          "appointmentData": {
            "calendarId": "your-calendar-id",
            "contactId": "{{trigger.contactId}}",
            "startTime": "2025-11-15T10:00:00Z",
            "endTime": "2025-11-15T11:00:00Z",
            "title": "Consultation Call",
            "notes": "Initial consultation"
          }
        },
        "outputAs": "appointment"
      },
      {
        "id": "send_confirmation",
        "module": "business.gohighlevel.sendEmail",
        "inputs": {
          "locationId": "your-location-id",
          "contactId": "{{trigger.contactId}}",
          "emailData": {
            "subject": "Appointment Confirmed",
            "body": "<p>Your appointment on {{appointment.startTime}} has been confirmed.</p>",
            "fromEmail": "noreply@yourcompany.com",
            "fromName": "Your Company"
          }
        }
      }
    ]
  }
}
```

### 4. Using Generic API Function (Maximum Flexibility)

For any GHL endpoint not covered by pre-built functions:

```json
{
  "version": "1.0",
  "name": "Custom GHL API Call",
  "config": {
    "steps": [
      {
        "id": "custom_endpoint",
        "module": "business.gohighlevel.apiRequest",
        "inputs": {
          "method": "POST",
          "endpoint": "/v2/custom-endpoint",
          "locationId": "your-location-id",
          "data": {
            "customField": "value"
          },
          "params": {
            "filter": "active"
          }
        },
        "outputAs": "result"
      }
    ]
  }
}
```

### 5. Tag Management Workflow

```json
{
  "version": "1.0",
  "name": "Auto-Tag High Value Leads",
  "config": {
    "steps": [
      {
        "id": "get_contact",
        "module": "business.gohighlevel.getContact",
        "inputs": {
          "locationId": "your-location-id",
          "contactId": "{{trigger.contactId}}"
        },
        "outputAs": "contact"
      },
      {
        "id": "get_all_tags",
        "module": "business.gohighlevel.getTags",
        "inputs": {
          "locationId": "your-location-id"
        },
        "outputAs": "allTags"
      },
      {
        "id": "add_vip_tag",
        "module": "business.gohighlevel.addTagToContact",
        "inputs": {
          "locationId": "your-location-id",
          "contactId": "{{contact.id}}",
          "tagId": "vip-tag-id"
        }
      }
    ]
  }
}
```

### 6. Workflow Trigger Integration

```json
{
  "version": "1.0",
  "name": "Trigger GHL Workflow from External Event",
  "config": {
    "steps": [
      {
        "id": "find_contact",
        "module": "business.gohighlevel.searchContacts",
        "inputs": {
          "locationId": "your-location-id",
          "filters": {
            "email": "{{trigger.email}}"
          }
        },
        "outputAs": "searchResult"
      },
      {
        "id": "trigger_workflow",
        "module": "business.gohighlevel.triggerWorkflow",
        "inputs": {
          "locationId": "your-location-id",
          "workflowId": "your-workflow-id",
          "contactId": "{{searchResult.contacts[0].id}}",
          "eventData": {
            "source": "external_integration",
            "timestamp": "{{utilities.datetime.now}}"
          }
        }
      }
    ]
  }
}
```

## Configuration

### Environment Variables

Set your GoHighLevel API key:

```bash
GHL_API_KEY=your-api-key-here
```

### Rate Limits

The module automatically handles GHL rate limits:
- **Burst**: 100 requests per 10 seconds
- **Daily**: 200,000 requests per day
- Circuit breakers prevent cascading failures
- Automatic retry with exponential backoff

## Available Functions

### Contacts
- `createContact(locationId, contactData)`
- `getContact(locationId, contactId)`
- `updateContact(locationId, contactId, updates)`
- `searchContacts(locationId, filters)`
- `deleteContact(locationId, contactId)`

### Opportunities
- `createOpportunity(locationId, opportunityData)`
- `updateOpportunity(locationId, opportunityId, updates)`
- `listOpportunities(locationId, filters)`

### Communication
- `sendSMS(locationId, contactId, message, options)`
- `sendEmail(locationId, contactId, emailData)`

### Appointments
- `createAppointment(locationId, appointmentData)`
- `listAppointments(locationId, filters)`

### Tags
- `getTags(locationId)`
- `addTagToContact(locationId, contactId, tagId)`
- `removeTagFromContact(locationId, contactId, tagId)`

### Custom Fields
- `updateCustomField(locationId, contactId, fieldId, value)`

### Workflows
- `triggerWorkflow(locationId, workflowId, contactId, eventData)`

### Generic API Access
- `apiRequest({ method, endpoint, locationId, data, params, headers })`

## Tips

1. **Use the generic `apiRequest` function** for new GHL features not yet covered by specific functions
2. **Variable passing** works seamlessly: `{{contact.id}}`, `{{opportunity.monetaryValue}}`
3. **Parallel execution** is automatic - independent steps run simultaneously
4. **Error handling** is built-in with circuit breakers and retries

## Next Steps

1. Set `GHL_API_KEY` environment variable
2. Get your `locationId` from GoHighLevel
3. Create workflows using the examples above
4. Test with `POST /api/workflows/execute-test`

For more information, see the full b0t documentation in `CLAUDE.md`.
