import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { loginLocal } from "./database";

export default function AuthScreen({ onLogin }) {
  const [username,setUsername] = useState("admin");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit() {
    if (!username.trim() || !password) return Alert.alert("Lengkapi data","Nama pengguna dan kata sandi wajib diisi.");
    setBusy(true);
    try { onLogin(await loginLocal(username,password)); }
    catch(e) { Alert.alert("Gagal masuk",e.message); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={s.wrap}>
      <View style={s.logo}><Text style={s.logoIcon}>▤</Text></View>
      <Text style={s.brand}>E-ARSIP KANTOR</Text>
      <Text style={s.subtitle}>Mode uji coba • 100% Offline</Text>
      <View style={s.panel}>
        <Text style={s.title}>Masuk ke aplikasi</Text>
        <Text style={s.label}>Nama pengguna</Text>
        <TextInput style={s.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="admin"/>
        <Text style={s.label}>Kata sandi</Text>
        <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Kata sandi"/>
        <TouchableOpacity disabled={busy} onPress={submit} style={s.button}><Text style={s.buttonText}>{busy?"Memeriksa...":"Masuk"}</Text></TouchableOpacity>
        <View style={s.demo}><Text style={s.demoTitle}>Akun demo offline</Text><Text style={s.demoText}>Admin: admin / admin12345</Text><Text style={s.demoText}>Pegawai: pegawai / pegawai12345</Text></View>
      </View>
      <Text style={s.footer}>Data tersimpan di perangkat ini. Tidak ada koneksi cloud.</Text>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#12345A"},wrap:{flex:1,justifyContent:"center",padding:22},logo:{width:62,height:62,borderRadius:18,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",alignSelf:"center",marginBottom:14},logoIcon:{fontSize:32,color:"#1769AA"},brand:{fontSize:22,fontWeight:"900",color:"#fff",textAlign:"center",letterSpacing:1},subtitle:{color:"#C4D5E8",textAlign:"center",marginTop:6,marginBottom:26},panel:{backgroundColor:"#fff",borderRadius:18,padding:20},title:{fontSize:20,fontWeight:"800",color:"#203A58",marginBottom:10},label:{fontSize:12,fontWeight:"700",color:"#4B5D73",marginTop:12,marginBottom:6},input:{backgroundColor:"#F8FAFC",borderWidth:1,borderColor:"#DCE4ED",borderRadius:9,padding:12,color:"#203A58"},button:{backgroundColor:"#1769AA",padding:14,borderRadius:10,alignItems:"center",marginTop:20},buttonText:{color:"#fff",fontWeight:"800"},demo:{backgroundColor:"#EFF5FB",padding:12,borderRadius:9,marginTop:16},demoTitle:{fontWeight:"800",color:"#234767",marginBottom:5},demoText:{fontSize:12,color:"#50677E",marginTop:2},footer:{color:"#C4D5E8",fontSize:11,textAlign:"center",marginTop:18}
});
