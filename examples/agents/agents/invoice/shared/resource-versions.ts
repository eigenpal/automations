// These are Git resource releases, not npm dependencies or tool imports.
// The CLI resolves the corresponding tags; TypeScript does not prove they exist.
export const invoiceResources = {
  'workspace:resources.skills.invoice-checks': '1.0.0',
  'workspace:resources.knowledge.tax-policy': '1.0.0',
  'workspace:resources.rules.invoice-style': '1.0.0',
} as const;
