# VITALYX SMART@Home-style JSON adapter proof of concept

This directory is deliberately isolated from the live application. It is not loaded by `dist/index.html` or `dist/app.js`; it does not change the UI or demo patient generator. The fixture contains fictional data only.

From the repository root, print the normalized fictional JSON:

```powershell
node json-poc/demo.cjs
```

Run the repeatable automated tests:

```powershell
node json-poc/test-adapter.cjs
```

The adapter returns one row per observed calendar date with VITALYX's current day-level fields: `date`, `trackerSubmitted`, `medicationReported`, `symptoms`, `zone`, `doses`, `readings`, `submissions`, `rescue`, `school`, and `feeling`. Every device attempt stays in `readings`, including rejected and conflicting attempts. Call `acceptedFev1Readings(day)` to obtain only explicitly accepted finite FEV1 values.

## What Section 3 explicitly provides

The official brief says a patient is represented by one nested JSON document with `dailyLogs[]`, per-day `trackerResponses[]` and `medicationAdministrations[]`, response `responses[]` with `questionId` and text `value`, and top-level `medications[]`, `reminders[]`, `medicalDevices[]` with `baselineReadings[]` and quality reports, `asthmaTreatmentPlan`, `earnedMedicationBadges[]`, and `earnedTrackerBadges[]`. It also calls out repeated, irregular tracker submissions; optional/empty fields; text-encoded values; question definitions outside the patient response record; medication association by long IDs; and use of fictional or de-identified data.

This is a prototype against those described structures. The brief does not define a complete production schema, so this code makes no claim of production SMART@Home compatibility.

## Assumptions used by this fixture and adapter

- The nested property names `patientId`, `trackerId`, `submittedAt`, `medicationId`, `reportedAt`, `administrationId`, `deviceId`, `readingId`, `measuredAt`, `fev1_L`, `accepted`, `qualityStatus`, and `qualityReports` are illustrative assumptions based on the supplied data examples, not a complete official field specification.
- The separate `question-definitions.js` lookup stands in for tracker question definitions; question wording is intentionally not duplicated in the patient fixture. It uses assumed question IDs and types (`singleChoice`, `checkbox`, and `number`). Numeric and checkbox response values are parsed from text; invalid or empty values stay unknown. A text-encoded FEV1 tracker answer is parsed as a number but is not promoted into quality-filtered device readings because Section 3 does not define a response-to-reading ID link.
- The fixture's `medications[].category` (`controller`/`rescue`) and string dose `value` are assumptions for demonstrating medication ID association. `doses` and `rescue` contain patient-reported amounts only. They are not verified administration. Missing mapped dose records produce `null`, not zero.
- `dailyLogs[].reportedActionPlanZone` and lower-case zone values are assumed so the expected VITALYX `zone` field can be demonstrated. The adapter does not infer a zone. If the source omits one, it returns `unknown`.
- The fixture assumes quality statuses `Acceptable` and `NotAcceptable`, an optional boolean `accepted`, and optional `qualityConflict`. Quality reports join to attempts by `readingId`. Conflicting signals are labeled `conflicting`; only an explicit accepted flag plus consistent acceptable quality information is accepted. Missing/unknown quality is excluded as `rejected` with an explanation.
- Dates are grouped by the recorded date prefix (no timezone conversion). Multiple submissions on a date increment `submissions`; symptoms are unioned across submitted answers; `feeling` and numeric `school` use the latest nonblank answer. A blank later response does not erase an earlier answer. This is a documented display aggregation, not a clinical interpretation.
- Repeated `dailyLogs` with the same date are merged. Device-only dates are included. The adapter treats an absent stream as unknown independently from other streams.

No backend, Epic connection, production database, or live dashboard integration is included.
