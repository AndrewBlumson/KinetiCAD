import { LegalPage, LegalSection } from "../components/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    num: 1,
    heading: "Who we are",
    paras: [
      `KinetiCAD is a free, browser-based computer-aided design tool operated by Adevious Ltd, trading as Adevious AI ("we", "us", "our"). This policy explains what information we do and do not collect when you use KinetiCAD at kineticad.co.uk.`,
      "We have written this policy to be short and honest, because KinetiCAD collects very little information about you.",
    ],
  },
  {
    num: 2,
    heading: "We do not have user accounts",
    paras: [
      "KinetiCAD has no sign-up, no login, and no user accounts. We do not ask you for your name, your email address, or any other personal detail in order to use the Service.",
    ],
  },
  {
    num: 3,
    heading: "Your design work stays on your device",
    paras: [
      "KinetiCAD processes your models and assemblies in your browser. Project recovery uses IndexedDB to retain current and previous complete recovery copies on your device, including imported STEP geometry. Some settings and older project data also use browser local storage. The application does not upload your design work to our servers.",
      "Save project downloads an editable file to your device, including the project's imported STEP assets. STEP and STL exports also download locally. Files you choose to share may therefore contain your design geometry and project details. Browser recovery is specific to the site and browser profile; clearing site data removes those local copies but does not remove files you have downloaded.",
    ],
  },
  {
    num: 4,
    heading: "Server logs",
    paras: [
      "Like almost all websites, our hosting provider keeps standard server logs when a page is requested. These logs may include your IP address, the date and time of the request, the page requested, and basic browser information. These logs are used only to operate the Service securely and to diagnose technical problems. They are not used to identify or track individual users.",
      "The pages request fonts from Google Fonts, and the CAD application downloads its OpenCascade WebAssembly component from jsDelivr. These requests contact those providers and expose normal connection information, such as your IP address and browser/request information, under their own policies. They request application assets, not your model or project contents. KinetiCAD does not use an AI service to process your designs or search for mechanisms.",
    ],
  },
  {
    num: 5,
    heading: "Analytics and cookies",
    paras: [
      "On the KinetiCAD site itself, we use no analytics and set no tracking or advertising cookies. The optional support link is an ordinary link, not an embedded payment widget. Buy Me a Coffee and its payment providers may use their own cookies and similar technologies after you visit their services, under their own notices and choices.",
      "If we introduce analytics in the future, we will update this policy to describe exactly what is used and what it collects, before or at the time it is introduced. If any future analytics requires cookie consent, we will add a cookie notice at that point.",
    ],
  },
  {
    num: 6,
    heading: "Optional support payments",
    paras: [
      "Supporting KinetiCAD is entirely optional. The Support KinetiCAD link opens Andrew Blumson's Buy Me a Coffee page in a new tab; support payments are received by Adevious Ltd. You can use the CAD app without visiting that page or making a payment.",
      "Checkout takes place on Buy Me a Coffee, whose published privacy policy identifies Stripe as its payment processor. The KinetiCAD app does not collect or store full card numbers or card security codes, and it does not send your CAD models or saved projects to either provider. Information you enter at checkout is handled by those services under their own terms and privacy notices.",
      "Buy Me a Coffee may make supporter information available to Adevious Ltd, including a name, email address, optional message and payment details such as the amount, date and status. The information available depends on what you provide and the platform's settings. A payment described as private on the platform does not necessarily hide all transaction information from the recipient or payment providers.",
      "Adevious Ltd is responsible for its use of the supporter information it receives. We use it to administer support payments, respond to related enquiries and handle payment or refund issues, relying on our legitimate interests in managing that support. We also retain records where required by accounting or other legal obligations. We keep information only as long as needed for those purposes and applicable record-keeping requirements. Making a support payment does not by itself subscribe you to a marketing mailing list.",
      <>For the providers' processing, retention and international-transfer information, read the <a href="https://buymeacoffee.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Buy Me a Coffee Privacy Policy (opens in a new tab)</a> and <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Stripe Privacy Policy (opens in a new tab)</a>. They may process information outside the UK. Questions about information held by Adevious Ltd can be sent to support@adevious.co.uk; questions about a provider's own processing should also be directed to that provider.</>,
    ],
  },
  {
    num: 7,
    heading: "Your rights",
    paras: [
      "Under UK data protection law you have rights over personal data we hold about you, including rights to access, correction, erasure, restriction, objection and, where applicable, portability. Which rights apply depends on the circumstances and the lawful basis for the processing. This can include information connected with an optional support payment as well as the other information described above. To exercise your rights or ask about information held by Adevious Ltd, contact us using the details below.",
      "You also have the right to lodge a complaint with the Information Commissioner's Office (ICO), the UK's data protection regulator, at ico.org.uk.",
    ],
  },
  {
    num: 8,
    heading: "Changes to this policy",
    paras: [
      "We may update this policy from time to time. The current version will always be available on this page, with the date it was last updated shown at the top.",
    ],
  },
  {
    num: 9,
    heading: "Contact",
    paras: [
      "KinetiCAD is operated by Adevious Ltd. For any question about this policy or your data, contact us at support@adevious.co.uk.",
      "Adevious AI is a trading name of Adevious Ltd. Company No. 08550853, registered in England and Wales. Registered office: Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="KinetiCAD — Privacy Policy"
      lastUpdated="12/09/2026"
      sections={SECTIONS}
    />
  );
}
