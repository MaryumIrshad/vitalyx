// Separate lookup: Section 3 says question wording/definitions live with tracker definitions,
// while patient response records carry questionId + text value.
module.exports = Object.freeze({
  'tracker-asthma-demo:q-feeling': Object.freeze({ questionText: 'How are you feeling?', type: 'singleChoice', field: 'feeling' }),
  'tracker-asthma-demo:q-symptoms': Object.freeze({ questionText: 'Which symptoms?', type: 'checkbox', field: 'symptoms' }),
  'tracker-asthma-demo:q-school-days': Object.freeze({ questionText: 'School days missed this week?', type: 'number', field: 'school' }),
  'tracker-asthma-demo:q-fev1-reading': Object.freeze({ questionText: 'Home FEV1 reading (text entry)', type: 'number', field: 'trackerFev1Text' })
});
