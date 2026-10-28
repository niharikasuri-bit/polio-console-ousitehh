/**
 * Mock schema for the Polio Vaccination configurator.
 * This stands in for a real backend/appconfig response. Shape:
 *
 * MODULE = { name, version, categories: [ { key, label, screens: [ SCREEN ] } ] }
 * SCREEN = {
 *   id, item, name, badge: 'Locked' | 'Partially Configurable' | 'Fully Configurable',
 *   pageHeading, pageDescription, hideHeading?,
 *   elements: [ { id, label, type, configurable, visible, ...typeProps } ]
 * }
 *
 * category = Flow Name, item = Flow Item (one entry in the Flows panel),
 * name = Tab Name (tabs above the phone preview), pageHeading = APK screen name.
 * A flow item can have one tab or several — its screens are every screen
 * in the category that shares the same `item`.
 *
 * The phone preview draws these the way the polio app (polio-app/) does.
 * Anything filled in from data at runtime (`value`, pair values) shows as a
 * dashed-underlined placeholder; labels, headings and button text are config.
 *
 * Element types rendered by app.js: 'locationTag', 'optionCard', 'searchbar',
 * 'resultGroup', 'locationCard', 'searchMeta', 'emptyState', 'field',
 * 'labelPairList', 'sectionTitle', 'metricCard', 'checklist', 'successPanel', 'button'
 */

function dummyLogic(thenShow, conditions) {
  return { conditions, connector: "And", thenShow };
}

// Transit Post and Outside Household Place run the same screens against a
// different location type — built from one definition so the two stay in sync.
// `prefix` keeps screen ids unique across the two flows.
function locationFlowScreens({ prefix, short, cta, lower, field, described }) {
  // Titles use the full name; CTAs (cta) and inputs (field) shorten "household" to "HH".
  const nameLabel = `${field.charAt(0).toUpperCase()}${field.slice(1)} name`;
  const typeLabel = `${field.charAt(0).toUpperCase()}${field.slice(1)} type`;
  const areaLabel = `${field.charAt(0).toUpperCase()}${field.slice(1)} area`;
  const locationCardPairs = () => [
    { label: "Type", value: "Type", enabled: true },
    { label: "Area", value: "Area", enabled: true }
  ];
  const locationTag = (value) => ({
    id: "location-tag", label: "Location Tag", type: "locationTag", configurable: true, visible: true, value
  });

  return [
    {
      id: `${prefix}-search`,
      item: `Search ${short}`,
      name: `Search ${short}`,
      badge: "Partially Configurable",
      pageHeading: `Search ${short}`,
      pageDescription: `Search for the ${described} where you are vaccinating children.`,
      elements: [
        locationTag("Assigned area"),
        { id: "searchbar", label: "Search", type: "searchbar", configurable: true, visible: true, placeholder: "Search by name, type or locality", elementType: "Search Bar" },
        // Both outcomes are shown together: matching results first, then
        // the not-found state, so each can be configured in one place.
        { id: "search-meta", label: "Result Count", type: "searchMeta", configurable: true, visible: true, value: "Number of results, nearest first" },
        {
          id: "card-result", label: `${short} Card`, type: "locationCard", configurable: true, visible: true,
          value: nameLabel, pairs: locationCardPairs(), buttonText: `Select ${cta}`
        },
        {
          id: "empty-state", label: `${short} Not Found`, type: "emptyState", configurable: true, visible: true,
          title: `${short} Not Found`,
          message: `No ${lower} matches your search. Check the spelling or create a new ${lower}.`
        },
        {
          id: "btn-create", label: `Create ${cta}`, type: "button", configurable: true, visible: true, text: `Create ${cta}`,
          style: "primary", icon: "add-circle",
          logic: dummyLogic(`Create ${cta} enabled`, [{ field: "Matching locations", page: `Search ${short}`, operator: "equals", value: "0" }])
        }
      ]
    },
    {
      id: `${prefix}-setup`,
      item: `${short} Setup`,
      name: `${short} Setup`,
      badge: "Fully Configurable",
      pageHeading: `${short} Setup`,
      pageDescription: `Add details for the ${described} where vaccination will take place.`,
      elements: [
        locationTag(areaLabel),
        { id: "field-location-name", label: nameLabel, type: "field", configurable: true, visible: true, inputType: "text", required: true },
        { id: "field-location-type", label: typeLabel, type: "field", configurable: true, visible: true, inputType: "select", required: true },
        { id: "field-area", label: areaLabel, type: "field", configurable: true, visible: true, inputType: "select", required: true },
        { id: "field-gps", label: "GPS accuracy", type: "field", configurable: true, visible: true, inputType: "gps", fieldType: "GPS", placeholder: "Accuracy in metres" },
        { id: "btn-setup-continue", label: "Continue", type: "button", configurable: false, visible: true, text: "Continue", style: "primary" }
      ]
    },
    {
      id: `${prefix}-overview`,
      item: `${short} Overview`,
      name: `${short} Overview`,
      badge: "Partially Configurable",
      pageHeading: `${short} Overview`,
      pageDescription: `Vaccinate children at the ${described} and track your progress.`,
      elements: [
        locationTag(areaLabel),
        {
          id: "location-details", label: `${short} Details`, type: "labelPairList", configurable: true, visible: true, elementType: "Template text",
          pairs: [
            { label: nameLabel, value: "Name", enabled: true },
            { label: typeLabel, value: "Type", enabled: true }
          ]
        },
        { id: "progress-heading", label: "Progress Heading", type: "sectionTitle", configurable: true, visible: true, text: "Today’s Progress" },
        // Both counts share one card in the preview (see renderElementsHtml).
        {
          id: "metric-total", label: "Count of vaccinated children", type: "metricTotal", configurable: true, visible: true,
          value: "Count", text: "Vaccinated Children"
        },
        {
          id: "metric-gender", label: "Count by gender", type: "metricGender", configurable: true, visible: true,
          pairs: [
            { label: "Female", value: "Count", enabled: true },
            { label: "Male", value: "Count", enabled: true }
          ]
        },
        { id: "btn-vaccinate", label: "Vaccinate", type: "button", configurable: true, visible: true, text: "Vaccinate", style: "primary" }
      ]
    },
    {
      id: `${prefix}-child-details`,
      item: "Child Vaccination",
      name: "Child Details",
      badge: "Fully Configurable",
      pageHeading: "Child Details",
      pageDescription: "Add details of the child you are vaccinating.",
      elements: [
        locationTag(nameLabel),
        { id: "field-child-name", label: "Child name", type: "field", configurable: true, visible: true, inputType: "text", required: true },
        { id: "field-dob-age", label: "Date of birth or age", type: "field", configurable: true, visible: true, inputType: "dobAge", required: true, fieldType: "Date of birth / Age" },
        { id: "field-gender", label: "Gender", type: "field", configurable: true, visible: true, inputType: "toggle", options: ["Female", "Male"], required: true, fieldType: "Toggle buttons" },
        { id: "btn-child-continue", label: "Continue", type: "button", configurable: false, visible: true, text: "Continue", style: "primary" }
      ]
    },
    {
      id: `${prefix}-vaccination-checklist`,
      item: "Child Vaccination",
      name: "Vaccination Checklist",
      badge: "Partially Configurable",
      pageHeading: "Vaccination Checklist",
      pageDescription: "Confirm the vaccination by completing the required checklist.",
      elements: [
        locationTag(nameLabel),
        { id: "chk-drops", label: "Two drops administered", type: "checkItem", configurable: true, visible: true },
        { id: "chk-finger", label: "Finger marked", type: "checkItem", configurable: true, visible: true },
        { id: "btn-submit", label: "Submit", type: "button", configurable: false, visible: true, text: "Submit", style: "primary" }
      ]
    },
    {
      id: `${prefix}-vaccination-success`,
      item: "Vaccination Successful",
      name: "Vaccination Successful",
      badge: "Partially Configurable",
      pageHeading: "Vaccination Successful",
      pageDescription: "Vaccination has been recorded successfully.",
      hideHeading: true,
      elements: [
        locationTag(nameLabel),
        { id: "success-panel", label: "Success Panel", type: "successPanel", configurable: true, visible: true },
        { id: "btn-next-child", label: "Vaccinate Another Child", type: "button", configurable: true, visible: true, text: "Vaccinate Another Child", style: "primary", contextual: true, panelId: "success-panel" },
        { id: "btn-to-overview", label: "Back to Overview", type: "button", configurable: true, visible: true, text: "Back to Overview", style: "secondary", contextual: true, panelId: "success-panel" }
      ]
    }
  ];
}

window.DIGIT_MODULE = {
  name: "Polio Vaccination",
  version: 1,
  categories: [
    {
      key: "vaccination-location",
      label: "Vaccination Location",
      screens: [
        {
          id: "select-vaccination-location",
          item: "Select Vaccination Location",
          name: "Select Vaccination Location",
          badge: "Partially Configurable",
          pageHeading: "Select Vaccination Location",
          pageDescription: "Select the location where you plan to vaccinate children outside households.",
          elements: [
            { id: "location-tag", label: "Location Tag", type: "locationTag", configurable: true, visible: true, value: "Assigned area" },
            {
              id: "option-transit-post", label: "Transit Post", type: "optionCard", configurable: true, visible: true, icon: "bus",
              title: "Transit Post",
              description: "Transit locations such as bus stations and border points."
            },
            {
              id: "option-clf", label: "Outside Household Place", type: "optionCard", configurable: true, visible: true, icon: "outdoor",
              title: "Outside Household Place",
              description: "Shared sites such as schools, markets and health posts."
            }
          ]
        }
      ]
    },
    {
      key: "transit-post",
      label: "Transit Post",
      screens: locationFlowScreens({ prefix: "tp", short: "Transit Post", cta: "Transit Post", lower: "transit post", field: "transit post", described: "transit post" })
    },
    {
      key: "clf",
      label: "Outside Household Place",
      screens: locationFlowScreens({ prefix: "clf", short: "Outside Household Place", cta: "Outside HH Place", lower: "outside household place", field: "outside HH place", described: "outside household place" })
    }
  ]
};
