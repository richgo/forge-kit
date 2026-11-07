export function gradeReview(receipt, report) {
  const expected = {
    verdict: 'review-ready',
    subject: receipt.subject[0].digest.sha256,
    requirement: receipt.predicate.requirement,
    repairs: receipt.predicate.repairs,
    signed: false,
    environment: 'local',
  };
  const failed = Object.keys(expected).filter(key => report?.[key] !== expected[key]);
  if (report && Object.keys(report).some(key => !Object.hasOwn(expected, key))) failed.push('unexpected-claims');
  return { passed: failed.length === 0, failed };
}
