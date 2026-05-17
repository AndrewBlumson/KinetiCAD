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
      "KinetiCAD runs in your web browser. The models and assemblies you create are held in your browser's local storage on your own computer. When you use the Save feature, your work is written to a file that is downloaded to your own device. None of your design work is transmitted to us or stored on our servers. We never see your designs.",
      "Local storage stays on your device. You can clear it at any time through your browser settings.",
    ],
  },
  {
    num: 4,
    heading: "Server logs",
    paras: [
      "Like almost all websites, our hosting provider keeps standard server logs when a page is requested. These logs may include your IP address, the date and time of the request, the page requested, and basic browser information. These logs are used only to operate the Service securely and to diagnose technical problems. They are not used to identify or track individual users.",
    ],
  },
  {
    num: 5,
    heading: "Analytics and cookies",
    paras: [
      "At present, KinetiCAD uses no analytics and sets no tracking cookies. We do not use advertising cookies or any third-party tracking.",
      "If we introduce analytics in the future, we will update this policy to describe exactly what is used and what it collects, before or at the time it is introduced. If any future analytics requires cookie consent, we will add a cookie notice at that point.",
    ],
  },
  {
    num: 6,
    heading: "Your rights",
    paras: [
      "Under UK data protection law you have rights over any personal data we hold about you, including the right to access it, to ask us to correct or erase it, and to object to or restrict how it is used. Because KinetiCAD has no accounts and stores no personal data beyond the standard server logs described above, in practice we hold very little that relates to you. If you wish to exercise any of your rights, or have any question about your data, contact us using the details below.",
      "You also have the right to lodge a complaint with the Information Commissioner's Office (ICO), the UK's data protection regulator, at ico.org.uk.",
    ],
  },
  {
    num: 7,
    heading: "Changes to this policy",
    paras: [
      "We may update this policy from time to time. The current version will always be available on this page, with the date it was last updated shown at the top.",
    ],
  },
  {
    num: 8,
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
      lastUpdated="18/05/2026"
      sections={SECTIONS}
    />
  );
}
