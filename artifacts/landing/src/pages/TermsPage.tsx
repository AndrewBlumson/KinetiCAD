import { LegalPage, LegalSection } from "../components/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    num: 1,
    heading: "About these terms",
    paras: [
      `KinetiCAD is a free, browser-based computer-aided design tool operated by Adevious Ltd, trading as Adevious AI ("we", "us", "our"). By using KinetiCAD at kineticad.co.uk (the "Service") you agree to these terms. If you do not agree to them, please do not use the Service.`,
    ],
  },
  {
    num: 2,
    heading: "Free access and optional support",
    paras: [
      "KinetiCAD is provided to you free of charge. We do not charge for access and there is no account, subscription, or licence fee for using the hosted Service.",
      "You may choose to support KinetiCAD through the linked Buy Me a Coffee page. Support payments are received by Adevious Ltd and are entirely optional. They do not purchase access, additional features, priority support or a commitment to deliver a particular update. Access to the app is the same whether or not you contribute.",
      <>Payments take place on Buy Me a Coffee using its checkout and payment providers. Review the amount and any recurring-payment option before confirming there. Its <a href="https://buymeacoffee.com/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Terms of Service (opens in a new tab)</a> apply to use of that platform. For support-payment questions or refund requests, contact support@adevious.co.uk; the platform's payment and refund processes also apply. Nothing in this section limits rights that cannot lawfully be excluded.</>,
    ],
  },
  {
    num: 3,
    heading: "No warranty",
    paras: [
      `The Service is provided "as is" and "as available", without warranty of any kind, whether express or implied. We do not warrant that the Service will be uninterrupted, error-free, secure, or that it will meet your requirements. You use the Service at your own risk.`,
    ],
  },
  {
    num: 4,
    heading: "Limitation of liability",
    paras: [
      "To the fullest extent permitted by law, Adevious Ltd will not be liable for any loss or damage arising from your use of, or inability to use, the Service. This includes, without limitation, loss of work, loss of data, loss of designs, or any indirect or consequential loss. You are responsible for your own work and for keeping your own backup copies of any files you create or save.",
      "Nothing in these terms excludes or limits our liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, or for fraud.",
    ],
  },
  {
    num: 5,
    heading: "Open source software",
    paras: [
      "KinetiCAD's released source code is licensed under the MIT Licence. You may use, copy, modify and distribute that source under the terms of the licence, including its copyright and permission-notice requirements. Third-party components retain their own licences. Optional support payments do not change these licence terms.",
      "These Terms of Service are separate from the MIT Licence. The MIT Licence governs your use of the source code. These terms govern your use of the hosted Service at kineticad.co.uk, which we operate.",
    ],
  },
  {
    num: 6,
    heading: "Availability",
    paras: [
      "The Service is provided on a best-effort basis. We do not guarantee any level of uptime or availability, and we may change, suspend, or withdraw the Service, in whole or in part, at any time without notice.",
    ],
  },
  {
    num: 7,
    heading: "Acceptable use",
    paras: [
      "You agree not to use the Service in any way that is unlawful, or that could damage, disable, or impair the Service or interfere with anyone else's use of it.",
    ],
  },
  {
    num: 8,
    heading: "Changes to these terms",
    paras: [
      "We may update these terms from time to time. The current version will always be available on this page, with the date it was last updated shown at the top.",
    ],
  },
  {
    num: 9,
    heading: "Governing law",
    paras: [
      "These terms are governed by the law of England and Wales, and any dispute will be subject to the exclusive jurisdiction of the courts of England and Wales.",
    ],
  },
  {
    num: 10,
    heading: "Contact",
    paras: [
      "KinetiCAD is operated by Adevious Ltd. For any questions about these terms, contact us at support@adevious.co.uk.",
      "Adevious AI is a trading name of Adevious Ltd. Company No. 08550853, registered in England and Wales. Registered office: Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="KinetiCAD — Terms of Service"
      lastUpdated="12/09/2026"
      sections={SECTIONS}
    />
  );
}
