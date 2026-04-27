const SECTIONS = [
  {
    title: "Name Handling",
    steps: [
      {
        name: "Split Full Name",
        step: "Step 0",
        defaultOff: true,
        description: "Splits a full name column into separate First Name, Middle Name, and Last Name columns. Inserts the new columns immediately after the source column.",
        needs: "Full Name column",
        creates: "First_Name, Middle_Name, Last_Name",
      },
      {
        name: "Remove Dots + Title Case Names",
        step: "Step 1",
        description: "Removes dots from name fields and converts every name to Title Case (e.g. \"john.\" → \"John\", \"MARY\" → \"Mary\"). Runs in-place on First Name, Middle Name, and Last Name.",
        needs: "First Name, Last Name (Middle Name optional)",
        creates: "Cleans existing name columns in-place",
      },
      {
        name: "Name / Company Match",
        step: "Step 2",
        description: "Flags records where the contact's name appears directly inside the company name field. Useful for detecting personal businesses listed as companies.",
        needs: "First Name, Last Name, Company",
        creates: "comments_name_company_match",
      },
      {
        name: "Non-Alpha Characters in Names",
        step: "Step 3",
        description: "Detects names containing non-standard characters. Allows hyphens and apostrophes. Flags accented or non-ASCII characters (é, ñ, etc.) and other symbols.",
        needs: "First Name, Last Name (Middle Name optional)",
        creates: "comments_non_alpha_name",
      },
      {
        name: "Dummy Names Check",
        step: "Step 4",
        description: "Detects placeholder or test names in the First Name or Last Name columns. Flags rows where either field contains a known dummy value: unknown, testing, test, xxx, dummy, n/a, na, none, null, sample.",
        needs: "First Name, Last Name",
        creates: "comments_dummy_names_check (True / False)",
      },
      {
        name: "Null Name Check",
        step: "Step 5",
        description: "Checks whether the First Name and Last Name columns are empty or blank. Creates a separate flag column for each.",
        needs: "First Name, Last Name",
        creates: "comments_first_name_null_values, comments_last_name_null_values (True / False)",
      },
    ],
  },
  {
    title: "Email Handling",
    steps: [
      {
        name: "Email Structure Validation",
        step: "Step 6",
        description: "Validates email addresses against standard format rules using regex. Flags malformed, missing, or structurally invalid addresses.",
        needs: "Email column",
        creates: "comments_email_structure",
      },
      {
        name: "Company / Email Domain Match",
        step: "Step 7",
        description: "Checks whether the email domain matches the company name. Skips free providers (gmail, yahoo, outlook, hotmail, etc.). Flags mismatches where the company name doesn't appear in the domain.",
        needs: "Company, Email",
        creates: "comments_company_email_domain",
      },
      {
        name: "Name / Email Fuzzy Match",
        step: "Step 8",
        description: "Fuzzy-matches the contact's first and last name against the local part of the email address (before the @). Configurable similarity threshold via slider (0–100).",
        needs: "First Name, Last Name, Email (Middle Name optional)",
        creates: "comments_name_email_fuzzy",
      },
      {
        name: "Email Reuse Check",
        step: "Step 9",
        description: "Detects email addresses that appear more than once in the same column. Repeated addresses are labelled 'Reused'; unique addresses are left blank.",
        needs: "Email column",
        creates: "comments_<email_column>_reused_column (Reused / blank)",
      },
      {
        name: "Email TLD Validity",
        step: "Step 10",
        description: "Checks whether the top-level domain (TLD) of the email address is a recognised IANA-registered TLD. Covers all generic TLDs (com, net, org, etc.), new gTLDs (app, blog, tech, etc.), and all 2-letter country-code TLDs.",
        needs: "Email column",
        creates: "comments_email_valid_tld (Valid / Not Valid)",
      },
      {
        name: "Disposable Email Check",
        step: "Step 11",
        description: "Flags email addresses whose domain belongs to a known disposable/throwaway provider such as mailinator, tempmail, guerrillamail, 10minutemail, yopmail, and hundreds more.",
        needs: "Email column",
        creates: "comments_email_temp_mail_check (True / False)",
      },
      {
        name: "Role-Based Email Check",
        step: "Step 12",
        description: "Detects generic role-account email addresses (info@, sales@, contact@, admin@, support@, noreply@, help@, billing@, hr@, marketing@, etc.) that are not tied to a specific person.",
        needs: "Email column",
        creates: "comments_<email_column>_role_account (True / False)",
      },
    ],
  },
  {
    title: "Phone Handling",
    steps: [
      {
        name: "Normalize Phone Numbers",
        step: "Step 13",
        description: "Standardizes phone numbers to XXX-XXX-XXXX format. Extracts country code, extension, area code, and line number. Flags invalid numbers. Runs once per mapped phone column.",
        needs: "Phone column(s) — supports multiple",
        creates: "6 columns per phone: country_code, standardized_number, ext, is_valid, region_us, number_type",
      },
      {
        name: "Phone / State Validation",
        step: "Step 14",
        description: "Validates that the phone area code matches the contact's office state using a US area code lookup table. Requires phone normalization to run first.",
        needs: "Normalized phone columns + Office State",
        creates: "comments_phone_state (per phone column)",
      },
      {
        name: "Reused Phone Number Check",
        step: "Step 15",
        description: "Checks all mapped phone columns across all rows to detect the same number appearing for different contacts (copy-paste errors). A row is labelled 'Reused' if any of its phone numbers also appears in another row. Phone digits are normalized (leading country code stripped) before comparison.",
        needs: "Phone column(s)",
        creates: "comments_reused_phone_number (Reused / blank)",
      },
    ],
  },
  {
    title: "Company & Industry",
    steps: [
      {
        name: "Normalize Employee Count",
        step: "Step 16",
        description: "Maps raw employee count strings to standardized bands. Handles k-notation (5k → 5,000; 1.5k → 1,500). Bands: 1-10, 10-25, 25-50, 50-100, 100-250, 250-500, 500-1K, 1K-2.5K, 2.5K-5K, 5K-10K, 10K+.",
        needs: "Employee Count column",
        creates: "employee_count (normalized band)",
      },
      {
        name: "Extract Primary Industry",
        step: "Step 19",
        description: "Extracts the primary industry from a '>'-delimited trade name string. Splits the value by '>' and takes the 3rd element as the primary industry label.",
        needs: "Primary Industry column",
        creates: "primary_industry_extracted",
      },
      {
        name: "SIC → NAICS Mapping",
        step: "Step 22",
        description: "Extracts 4-digit SIC codes from the source column and maps them to the corresponding NAICS code using a built-in lookup table.",
        needs: "SIC Code column",
        creates: "naics_code",
      },
      {
        name: "Company Revenue Unusual Characters",
        step: "Step 27",
        description: "Checks the Company Revenue column for characters outside the expected set. Allowed: digits (0–9), M, B, K (million/billion/thousand), $, >, <, -, space, dot, and comma. Any other character flags the row as TRUE.",
        needs: "Company Revenue column",
        creates: "comments_company_revenue_unusual_charactors (True / False)",
      },
      {
        name: "City / State / Postal Code Match",
        step: "Step 28",
        description: "Looks up the postal code in a US ZIP code database (42,741 entries). Checks whether the Office State and Office City columns both match the database record for that ZIP. Handles ZIP+4 format (e.g. 90249-1234), leading zeros (e.g. 00501), and case differences. Both city and state must match for TRUE.",
        needs: "Office Postal Code, Office State, Office City",
        creates: "comments_city_state_match_postal_code (True / False)",
      },
    ],
  },
  {
    title: "Link Text & Description",
    steps: [
      {
        name: "Link Text / Description Match",
        step: "Step 23",
        description: "Matches the contact's name and company name against the Link Text and Description fields using both exact word matching and fuzzy matching (rapidfuzz). Exact match scores words token-by-token; fuzzy match uses a configurable similarity threshold slider (0–100, default 85). Each pair produces a label: Matched, Most_matched (≥75% words matched), Partial_match, or Not_match.",
        needs: "Company, Link Text, Description, and Name columns (Full Name or First + Last)",
        creates: "comments_name_link_exact, comments_name_link_fuzzy, comments_company_link_exact, comments_company_link_fuzzy, comments_company_desc_exact, comments_company_desc_fuzzy",
      },
    ],
  },
  {
    title: "Record Identity",
    steps: [
      {
        name: "Unique Identifier Check",
        step: "Step 24",
        defaultOff: true,
        description: "Checks whether every value in the Unique Identifier column is unique across all rows. Blank / empty values are skipped.",
        needs: "Unique Identifier column",
        creates: "Comments_unique_identifier_verifier (Unique / Duplicate)",
      },
      {
        name: "Drop Duplicate Rows",
        step: "Step 26",
        defaultOff: true,
        description: "Removes duplicate rows from the output. If a Unique Identifier column is mapped, duplicates are detected on that column alone (first occurrence kept). Otherwise, rows that are completely identical across all columns are removed. Runs last in the pipeline so all annotation columns are preserved before any row is dropped.",
        needs: "No required column — uses Unique Identifier column if mapped, otherwise all columns",
        creates: "No new column — removes rows in-place",
      },
    ],
  },
  {
    title: "Facebook",
    steps: [
      {
        name: "Facebook Name Match",
        step: "Step 25",
        description: "Fuzzy-matches the contact's first and last name against (1) the personal slug in their Facebook profile URL (e.g. 'john.smith' from facebook.com/john.smith) and (2) any extra text columns mapped as Facebook Link Text 1 or Facebook Description 1. A row is labelled matched if any source produces a match. Configurable similarity threshold via slider (0–1).",
        needs: "First Name, Last Name (Middle Name optional) + at least one of: Facebook URL, Facebook Link Text 1, Facebook Description 1",
        creates: "comments_facebook_match (matched / not matched / invalid)",
      },
    ],
  },
  {
    title: "LinkedIn & Job Title",
    steps: [
      {
        name: "LinkedIn Name Match",
        step: "Step 17",
        description: "Fuzzy-matches the contact's name against the slug in their LinkedIn profile URL (e.g. 'john-smith' from linkedin.com/in/john-smith). Configurable similarity threshold via slider (0–1).",
        needs: "First Name, Last Name, LinkedIn URL (Middle Name optional)",
        creates: "comments_linkedin_match",
      },
      {
        name: "LinkedIn URL /in/ Validity",
        step: "Step 18",
        description: "Checks whether the LinkedIn URL follows the standard personal profile format (linkedin.com/in/<slug>). URLs pointing to posts, pages, groups, or other paths are labelled invalid.",
        needs: "LinkedIn URL column",
        creates: "comments_linkedin_url_valid_by_in (valid / invalid)",
      },
      {
        name: "Job Title Categorization",
        step: "Step 20",
        description: "Categorizes job titles into standard seniority groups using keyword matching: Founder, Owner, C-Suite (CEO/CTO/CFO etc.), VP, Director, Head, Manager, Partner, Principal. Unmatched titles are left uncategorized.",
        needs: "Job Title column",
        creates: "job_title_category",
      },
      {
        name: "Job Title Non-Alphabetical Check",
        step: "Step 21",
        description: "Flags job titles containing unexpected characters such as digits or special symbols. Allows letters, spaces, hyphens, apostrophes, dots, ampersands (&), forward slashes, and parentheses — all common in real job titles.",
        needs: "Job Title column",
        creates: "comments_job_title_non_Alphabetical_charactor_appears (True / False)",
      },
    ],
  },
]

export default function InfoPanel({ open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-violet-700">Pipeline Documentation</h2>
            <p className="text-xs text-gray-400 mt-0.5">What each step does and what it creates</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.steps.map(step => (
                  <div key={step.name} className="border border-gray-200 rounded-lg p-3.5 hover:border-violet-300 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{step.name}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">{step.step}</span>
                        {step.defaultOff && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">Default OFF</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5">{step.description}</p>
                    <div className="space-y-1">
                      <div className="flex gap-1.5 text-xs">
                        <span className="font-medium text-gray-500 shrink-0">Needs:</span>
                        <span className="text-gray-400">{step.needs}</span>
                      </div>
                      <div className="flex gap-1.5 text-xs">
                        <span className="font-medium text-gray-500 shrink-0">Creates:</span>
                        <span className="text-violet-600 font-mono">{step.creates}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Output format note */}
          <div className="bg-violet-50 border border-violet-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-violet-700 mb-1">Output Format</p>
            <p className="text-xs text-violet-600 leading-relaxed">
              All new columns are added to the right of their source column in the output Excel file.
              New column headers are highlighted in <strong>light purple</strong> for easy identification.
              Source data is never modified.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
