import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JSX } from "react";

import type { GeneratedResumeContent, Profile } from "@/types";

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica" },
  name: { fontSize: 18, fontWeight: "bold" },
  contactLine: { marginTop: 2, fontSize: 10, color: "#444444" },
  section: { marginTop: 14 },
  heading: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  text: { fontSize: 10, lineHeight: 1.4 },
  roleBlock: { marginBottom: 8 },
  roleTitle: { fontSize: 10.5, fontWeight: "bold" },
  roleDates: { fontSize: 9, color: "#444444", marginBottom: 2 },
  bullet: { fontSize: 10, lineHeight: 1.4 },
});

function formatHighestDegree(value: Profile["education"]["highestDegree"]): string {
  switch (value) {
    case "high_school":
      return "High School Diploma";
    case "associate":
      return "Associate Degree";
    case "bachelor":
      return "Bachelor's Degree";
    case "master":
      return "Master's Degree";
    case "doctorate":
      return "Doctorate";
    default:
      return "";
  }
}

interface ResumePdfDocumentProps {
  content: GeneratedResumeContent;
  profile: Profile;
}

export function ResumePdfDocument({ content, profile }: ResumePdfDocumentProps): JSX.Element {
  const contactParts = [profile.email, profile.phone, profile.location].filter(
    (part) => part.trim().length > 0,
  );
  const linkParts = [profile.linkedinUrl, profile.portfolioUrl].filter(
    (part) => part.trim().length > 0,
  );
  const degreeLabel = formatHighestDegree(profile.education.highestDegree);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{profile.fullName}</Text>
        {contactParts.length > 0 ? (
          <Text style={styles.contactLine}>{contactParts.join(" · ")}</Text>
        ) : null}
        {linkParts.length > 0 ? (
          <Text style={styles.contactLine}>{linkParts.join(" · ")}</Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Professional Summary</Text>
          <Text style={styles.text}>{content.summary}</Text>
        </View>

        {profile.skills.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Skills</Text>
            <Text style={styles.text}>{profile.skills.join(", ")}</Text>
          </View>
        ) : null}

        {profile.workExperience.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Experience</Text>
            {profile.workExperience.map((entry, index) => (
              <View key={`${entry.company}-${index}`} style={styles.roleBlock}>
                <Text style={styles.roleTitle}>
                  {entry.jobTitle} — {entry.company}
                </Text>
                <Text style={styles.roleDates}>
                  {entry.startDate} – {entry.currentlyWorkingHere ? "Present" : entry.endDate}
                </Text>
                {(content.workExperienceBullets[index] ?? []).map((bullet, bulletIndex) => (
                  <Text key={bulletIndex} style={styles.bullet}>
                    • {bullet}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {degreeLabel ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Education</Text>
            <Text style={styles.text}>
              {[degreeLabel, profile.education.fieldOfStudy, profile.education.institutionName, profile.education.graduationYear]
                .filter((part) => part.trim().length > 0)
                .join(", ")}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
