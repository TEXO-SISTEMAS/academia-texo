import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface Props {
  participantName: string;
  courseTitle: string;
  completedAt: Date;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#1a2a2e",
    paddingTop: 60,
    paddingBottom: 60,
    paddingLeft: 80,
    paddingRight: 80,
  },
  outerBorder: {
    borderWidth: 3,
    borderColor: "#E8B84B",
    borderStyle: "solid",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    paddingBottom: 50,
    paddingLeft: 60,
    paddingRight: 60,
  },
  innerBorder: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 1,
    borderColor: "#7a5f25",
    borderStyle: "solid",
  },
  academia: {
    fontSize: 22,
    color: "#E8B84B",
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  grupoTexo: {
    fontSize: 11,
    color: "#3A9688",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "Helvetica",
  },
  etiqueta: {
    fontSize: 10,
    color: "#E8B84B",
    textAlign: "center",
    marginBottom: 14,
    fontFamily: "Helvetica",
    textTransform: "uppercase",
  },
  separador: {
    width: 60,
    height: 1.5,
    backgroundColor: "#E8B84B",
    marginBottom: 20,
  },
  certifica: {
    fontSize: 13,
    color: "#98adb1",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Helvetica",
  },
  nombre: {
    fontSize: 40,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 14,
    fontFamily: "Times-Roman",
  },
  lineaNombre: {
    width: 160,
    height: 1,
    backgroundColor: "#7a5f25",
    marginBottom: 14,
  },
  haCompletado: {
    fontSize: 13,
    color: "#98adb1",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Helvetica",
  },
  curso: {
    fontSize: 24,
    color: "#3A9688",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "Times-Roman",
  },
  fecha: {
    fontSize: 12,
    color: "#527178",
    textAlign: "center",
    fontFamily: "Helvetica",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    fontSize: 9,
    color: "#2e4449",
    textAlign: "center",
    fontFamily: "Helvetica",
    textTransform: "uppercase",
  },
});

export default function CertificatePDF({ participantName, courseTitle, completedAt }: Props) {
  const dateStr = completedAt.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder} />

          <Text style={styles.academia}>ACADEMIA</Text>
          <Text style={styles.grupoTexo}>GRUPO TEXO</Text>
          <Text style={styles.etiqueta}>Certificado de Finalización</Text>
          <View style={styles.separador} />
          <Text style={styles.certifica}>Se certifica que</Text>
          <Text style={styles.nombre}>{participantName}</Text>
          <View style={styles.lineaNombre} />
          <Text style={styles.haCompletado}>ha completado exitosamente el propedéutico</Text>
          <Text style={styles.curso}>{courseTitle}</Text>
          <Text style={styles.fecha}>{dateStr}</Text>
        </View>

        <Text style={styles.footer}>Grupo TEXO · Academia de Formación Interna</Text>
      </Page>
    </Document>
  );
}
