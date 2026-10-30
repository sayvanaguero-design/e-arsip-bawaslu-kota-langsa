
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { StatusBar } from "expo-status-bar";
import {
  initDb, allDocuments, saveDocument, deleteDocument
} from "./database";
import AuthScreen from "./AuthScreen";

const CATEGORIES = [
  "Umum", "Keuangan", "Kepegawaian", "Kontrak",
  "Legal", "Operasional", "Lainnya"
];

const EMPTY = {
  title: "",
  doc_number: "",
  category: "Umum",
  doc_type: "Surat Masuk",
  doc_date: new Date().toISOString().slice(0, 10),
  sender_receiver: "",
  notes: "",
  file_uri: "",
  file_name: ""
};

export default function App() {
  const [tab, setTab] = useState("Beranda");
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const rows = await allDocuments();
    setDocs(rows);
  }

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await refresh();
      } catch (error) {
        Alert.alert(
          "Gagal membuka database",
          String(error?.message || error)
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const filtered = useMemo(() => docs.filter(d =>
    [
      d.title,
      d.doc_number,
      d.category,
      d.sender_receiver,
      d.doc_type
    ].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [docs, search]);

  function newDoc() {
    setForm({ ...EMPTY });
    setModal(true);
  }

  function editDoc(item) {
    setForm({ ...item });
    setModal(true);
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ]
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const dir = `${FileSystem.documentDirectory}arsip/`;

      await FileSystem.makeDirectoryAsync(dir, {
        intermediates: true
      });

      const safeName = asset.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const destination = `${dir}${Date.now()}_${safeName}`;

      await FileSystem.copyAsync({
        from: asset.uri,
        to: destination
      });

      setForm(old => ({
        ...old,
        file_uri: destination,
        file_name: asset.name,
        storage_path: null,
        download_url: null
      }));
    } catch (error) {
      Alert.alert(
        "Gagal memilih lampiran",
        String(error?.message || error)
      );
    }
  }

  async function submit() {
    if (saving) return;

    const title = String(form.title || "").trim();

    if (!title) {
      Alert.alert(
        "Data belum lengkap",
        "Nama/judul dokumen wajib diisi."
      );
      return;
    }

    setSaving(true);

    try {
      await saveDocument({
        ...form,
        title
      });

      await refresh();

      setModal(false);
      setForm({ ...EMPTY });

      Alert.alert(
        "Berhasil",
        "Dokumen berhasil disimpan di perangkat ini."
      );
    } catch (error) {
      Alert.alert(
        "Gagal menyimpan",
        String(error?.message || error)
      );
    } finally {
      setSaving(false);
    }
  }

  function remove(item) {
    Alert.alert(
      "Hapus dokumen",
      `Hapus "${item.title}" dari arsip lokal?`,
      [
        {
          text: "Batal",
          style: "cancel"
        },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDocument(item.id);
              await refresh();
            } catch (error) {
              Alert.alert(
                "Gagal menghapus",
                String(error?.message || error)
              );
            }
          }
        }
      ]
    );
  }

  const Card = ({ children, style }) => (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );

  const Action = ({ label, onPress, primary = false }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.action,
        primary && styles.primary
      ]}
    >
      <Text
        style={[
          styles.actionText,
          primary && { color: "#fff" }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const DocRow = ({ item }) => (
    <TouchableOpacity
      onPress={() => editDoc(item)}
      onLongPress={() => remove(item)}
      style={styles.docRow}
    >
      <View style={styles.fileIcon}>
        <Text style={{ fontSize: 20 }}>▤</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.docTitle}>
          {item.title}
        </Text>

        <Text style={styles.muted}>
          {item.doc_number || "Tanpa nomor"} • {item.category || "Umum"}
        </Text>

        <Text style={styles.muted}>
          {item.doc_type} • {item.doc_date || "-"}
        </Text>
      </View>

      <Text
        style={{
          color: item.synced ? "#16A36A" : "#D18A20"
        }}
      >
        {item.synced ? "●" : "○"}
      </Text>
    </TouchableOpacity>
  );

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ color: "#fff" }}>
            Menyiapkan arsip lokal...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen onLogin={setSession} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>
          E-ARSIP KANTOR
        </Text>

        <Text style={styles.headerSub}>
          {session.displayName} •
          {session.role === "admin" ? "Administrator" : "Pegawai"}
          {" "}• OFFLINE
        </Text>

        <TouchableOpacity
          onPress={() => setSession(null)}
          style={styles.logout}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Keluar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {["Beranda", "Semua Arsip"].map(value => (
          <TouchableOpacity
            key={value}
            onPress={() => setTab(value)}
            style={[
              styles.tab,
              tab === value && styles.tabActive
            ]}
          >
            <Text
              style={[
                styles.tabText,
                tab === value && styles.tabTextActive
              ]}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "Beranda" ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.greeting}>
            Selamat datang 👋
          </Text>

          <Text style={styles.muted}>
            Kelola arsip kantor dalam satu aplikasi.
          </Text>

          <View style={styles.stats}>
            <Card style={styles.statCard}>
              <Text style={styles.statNum}>
                {docs.length}
              </Text>
              <Text style={styles.muted}>
                Total dokumen
              </Text>
            </Card>

            <Card style={styles.statCard}>
              <Text style={styles.statNum}>
                {docs.filter(d => d.doc_type === "Surat Masuk").length}
              </Text>
              <Text style={styles.muted}>
                Surat masuk
              </Text>
            </Card>

            <Card style={styles.statCard}>
              <Text style={styles.statNum}>
                {docs.filter(d => d.doc_type === "Surat Keluar").length}
              </Text>
              <Text style={styles.muted}>
                Surat keluar
              </Text>
            </Card>
          </View>

          <Card>
            <Text style={styles.sectionTitle}>
              Akses cepat
            </Text>

            <View style={styles.quickRow}>
              <Action
                label="+ Tambah dokumen"
                primary
                onPress={newDoc}
              />

              <Action
                label="Lihat arsip"
                onPress={() => setTab("Semua Arsip")}
              />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>
              Penyimpanan
            </Text>

            <Text style={styles.muted}>
              Mode offline aktif. Semua data dan lampiran disimpan
              di perangkat ini.
            </Text>

            <Text style={styles.muted}>
              Sinkronisasi cloud belum diaktifkan pada versi ini.
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>
            Dokumen terbaru
          </Text>

          {docs.slice(0, 4).map(item => (
            <DocRow key={item.id} item={item} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          <View style={styles.search}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Cari judul, nomor, kategori..."
              placeholderTextColor="#8B98A9"
              style={{ flex: 1, color: "#172B4D" }}
            />
            <Text>⌕</Text>
          </View>

          <View style={styles.listHead}>
            <Text style={styles.sectionTitle}>
              Semua arsip ({filtered.length})
            </Text>

            <Action
              label="+ Tambah"
              primary
              onPress={newDoc}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <DocRow item={item} />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Belum ada dokumen. Tekan Tambah untuk memulai.
              </Text>
            }
          />

          <Text style={styles.hint}>
            Ketuk dokumen untuk mengedit. Tekan lama untuk menghapus.
          </Text>
        </View>
      )}

      <Modal
        visible={modal}
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setModal(false);
        }}
      >
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setModal(false)}
                disabled={saving}
                style={styles.headerButton}
              >
                <Text style={styles.cancel}>
                  Batal
                </Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>
                {form.id ? "Edit dokumen" : "Dokumen baru"}
              </Text>

              <TouchableOpacity
                onPress={submit}
                activeOpacity={0.6}
                hitSlop={{
                  top: 15,
                  bottom: 15,
                  left: 15,
                  right: 15
                }}
                disabled={saving}
                style={styles.saveButton}
              >
                <Text style={styles.save}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>
                Nama / judul dokumen *
              </Text>

              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={value =>
                  setForm(old => ({
                    ...old,
                    title: value
                  }))
                }
                placeholder="Contoh: Surat Undangan Rapat"
              />

              <Text style={styles.label}>
                Jenis arsip
              </Text>

              <View style={styles.chips}>
                {["Surat Masuk", "Surat Keluar", "Dokumen Umum"].map(value => (
                  <TouchableOpacity
                    key={value}
                    onPress={() =>
                      setForm(old => ({
                        ...old,
                        doc_type: value
                      }))
                    }
                    style={[
                      styles.chip,
                      form.doc_type === value && styles.chipOn
                    ]}
                  >
                    <Text
                      style={
                        form.doc_type === value
                          ? styles.chipTextOn
                          : styles.chipText
                      }
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Nomor dokumen
              </Text>

              <TextInput
                style={styles.input}
                value={form.doc_number || ""}
                onChangeText={value =>
                  setForm(old => ({
                    ...old,
                    doc_number: value
                  }))
                }
                placeholder="Nomor surat / dokumen"
              />

              <Text style={styles.label}>
                Kategori
              </Text>

              <View style={styles.chips}>
                {CATEGORIES.map(value => (
                  <TouchableOpacity
                    key={value}
                    onPress={() =>
                      setForm(old => ({
                        ...old,
                        category: value
                      }))
                    }
                    style={[
                      styles.chip,
                      form.category === value && styles.chipOn
                    ]}
                  >
                    <Text
                      style={
                        form.category === value
                          ? styles.chipTextOn
                          : styles.chipText
                      }
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Tanggal (YYYY-MM-DD)
              </Text>

              <TextInput
                style={styles.input}
                value={form.doc_date || ""}
                onChangeText={value =>
                  setForm(old => ({
                    ...old,
                    doc_date: value
                  }))
                }
                placeholder="2026-10-30"
              />

              <Text style={styles.label}>
                Pengirim / penerima
              </Text>

              <TextInput
                style={styles.input}
                value={form.sender_receiver || ""}
                onChangeText={value =>
                  setForm(old => ({
                    ...old,
                    sender_receiver: value
                  }))
                }
                placeholder="Nama instansi / orang"
              />

              <Text style={styles.label}>
                Catatan
              </Text>

              <TextInput
                style={[styles.input, styles.notes]}
                multiline
                value={form.notes || ""}
                onChangeText={value =>
                  setForm(old => ({
                    ...old,
                    notes: value
                  }))
                }
                placeholder="Keterangan tambahan"
              />

              <Action
                label={
                  form.file_name
                    ? `📎 ${form.file_name}`
                    : "+ Lampirkan file"
                }
                onPress={pickFile}
              />

              {!!form.file_uri && (
                <Action
                  label="Buka lampiran lokal"
                  onPress={() =>
                    Linking.openURL(form.file_uri).catch(() =>
                      Alert.alert(
                        "Tidak dapat membuka file",
                        "Gunakan aplikasi pembaca file yang sesuai."
                      )
                    )
                  }
                />
              )}

              <Text style={styles.hint}>
                Lampiran disalin ke penyimpanan aplikasi agar tetap
                tersedia offline. Sinkronisasi cloud belum diaktifkan.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3F6FA"
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    backgroundColor: "#12345A",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20
  },
  brand: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1
  },
  headerSub: {
    color: "#C4D5E8",
    marginTop: 4,
    fontSize: 12
  },
  logout: {
    position: "absolute",
    right: 18,
    top: 20
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#E5EAF0"
  },
  tab: {
    paddingVertical: 14,
    marginRight: 22,
    borderBottomWidth: 3,
    borderColor: "transparent"
  },
  tabActive: {
    borderColor: "#1E72C7"
  },
  tabText: {
    color: "#748196",
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#164B7A"
  },
  content: {
    padding: 16,
    flex: 1
  },
  greeting: {
    fontSize: 23,
    fontWeight: "800",
    color: "#172B4D",
    marginTop: 6
  },
  muted: {
    color: "#7C899B",
    fontSize: 12,
    marginTop: 4
  },
  stats: {
    flexDirection: "row",
    marginVertical: 18
  },
  statCard: {
    flex: 1,
    marginHorizontal: 3
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 14,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E8EDF3"
  },
  statNum: {
    fontSize: 25,
    fontWeight: "800",
    color: "#164B7A"
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#233A58",
    marginBottom: 10
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  action: {
    borderWidth: 1,
    borderColor: "#D7E0EA",
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginRight: 7
  },
  primary: {
    backgroundColor: "#1769AA",
    borderColor: "#1769AA"
  },
  actionText: {
    fontWeight: "700",
    color: "#275273",
    fontSize: 12
  },
  docRow: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EDF3"
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#E8F2FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11
  },
  docTitle: {
    fontWeight: "700",
    color: "#233A58",
    fontSize: 13
  },
  search: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E1E8F0"
  },
  listHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  empty: {
    textAlign: "center",
    color: "#8995A5",
    marginTop: 50
  },
  hint: {
    fontSize: 11,
    color: "#8995A5",
    marginTop: 8
  },
  modalSafe: {
    flex: 1,
    backgroundColor: "#F4F7FA"
  },
  modalHeader: {
    height: 56,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    borderBottomWidth: 1,
    borderColor: "#E6EBF1"
  },
  headerButton: {
    minWidth: 55,
    minHeight: 48,
    justifyContent: "center"
  },
  cancel: {
    color: "#6D7B8E"
  },
  modalTitle: {
    fontWeight: "800",
    color: "#203A58"
  },
  saveButton: {
    minWidth: 85,
    minHeight: 48,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  save: {
    color: "#1769AA",
    fontWeight: "800",
    fontSize: 14
  },
  form: {
    padding: 18,
    paddingBottom: 40
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5D73",
    marginTop: 14,
    marginBottom: 7
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DCE4ED",
    borderRadius: 9,
    padding: 12,
    color: "#203A58"
  },
  notes: {
    height: 90,
    textAlignVertical: "top"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    backgroundColor: "#fff",
    marginRight: 7,
    marginBottom: 7
  },
  chipOn: {
    backgroundColor: "#1769AA",
    borderColor: "#1769AA"
  },
  chipText: {
    color: "#43536B"
  },
  chipTextOn: {
    color: "#fff"
  }
});
