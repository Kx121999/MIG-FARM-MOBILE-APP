import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlaskConical, Plus } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountField, AccountPage, Notice, ui } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { farmService } from '@/services/farm';
import type { AgriculturalAnalysis, FarmZone } from '@/types/farm';

const keys = ['pH','EC','salinity','organicMatter','N','P','K','Ca','Mg','Na','bicarbonate'] as const;
type ResultKey = typeof keys[number];

export default function FarmAnalysesScreen() {
  const { farmId = '' } = useLocalSearchParams<{ farmId: string }>();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [analyses, setAnalyses] = useState<AgriculturalAnalysis[]>([]);
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<'soil'|'water'>('soil');
  const [zoneId, setZoneId] = useState('');
  const [sampledAt, setSampledAt] = useState(new Date().toISOString().slice(0,10));
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const [results, setResults] = useState<Partial<Record<ResultKey,string>>>({});

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true); setError('');
    try { const [nextAnalyses, nextZones] = await Promise.all([farmService.analyses(farmId), farmService.zones(farmId)]); setAnalyses(nextAnalyses); setZones(nextZones); }
    catch { setError(ar ? 'تعذر تحميل التحاليل.' : 'Could not load analyses.'); }
    finally { setLoading(false); }
  }, [farmId, ar]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const parsed: AgriculturalAnalysis['results'] = {};
    for (const key of keys) {
      const value = results[key]?.trim();
      if (!value) continue;
      const number = Number(value);
      if (!Number.isFinite(number)) return setError(ar ? `قيمة ${key} غير صحيحة.` : `${key} is not a valid number.`);
      parsed[key] = number;
    }
    setBusy(true); setError('');
    try {
      await farmService.createAnalysis({ farmId, zoneId: zoneId || null, type, sampledAt, labName: labName.trim() || null, results: parsed, notes: notes.trim() });
      setResults({}); setLabName(''); setNotes(''); setAdding(false); await load();
    } catch { setError(ar ? 'تعذر حفظ التحليل. تحقق من التاريخ والقيم.' : 'Could not save the analysis. Check the date and values.'); }
    finally { setBusy(false); }
  };

  return <AccountPage title={ar ? 'تحاليل التربة والمياه' : 'Soil and water analyses'}>
    <Notice text={ar ? 'هذه نتائج فعلية تدخلها من تقرير المختبر. التطبيق لا يفسرها أو يحولها إلى جرعات تلقائياً.' : 'Enter actual lab results. The app does not interpret them or turn them into automatic doses.'}/>
    {error ? <Notice error text={error}/> : null}
    {analyses.length ? <FarmSection title={ar?'اتجاه القياسات المسجلة':'Recorded measurement trends'}><MeasurementHistory analyses={analyses} ar={ar} rtl={isRTL}/></FarmSection> : null}
    <FarmSection title={ar ? 'التحاليل المسجلة' : 'Recorded analyses'} action={adding ? (ar ? 'إلغاء' : 'Cancel') : (ar ? 'إضافة تحليل' : 'Add analysis')} onAction={() => setAdding((value) => !value)}>
      {adding ? <View style={farmUI.card}>
        <Text style={[ui.label,{textAlign:isRTL?'right':'left'}]}>{ar ? 'نوع التحليل' : 'Analysis type'}</Text><View style={[styles.choices,{flexDirection:isRTL?'row-reverse':'row'}]}><Choice label={ar?'تربة':'Soil'} active={type==='soil'} onPress={()=>setType('soil')}/><Choice label={ar?'مياه':'Water'} active={type==='water'} onPress={()=>setType('water')}/></View>
        {zones.length ? <><Text style={[ui.label,{textAlign:isRTL?'right':'left'}]}>{ar ? 'المنطقة (اختياري)' : 'Zone (optional)'}</Text><View style={styles.choices}><Choice label={ar?'كل المزرعة':'Whole farm'} active={!zoneId} onPress={()=>setZoneId('')}/>{zones.map((zone)=><Choice key={zone.id} label={zone.name} active={zoneId===zone.id} onPress={()=>setZoneId(zone.id)}/>)}</View></> : null}
        <AccountField label={ar ? 'تاريخ أخذ العينة' : 'Sample date'} value={sampledAt} onChangeText={setSampledAt} ltr placeholder="YYYY-MM-DD"/>
        <AccountField label={ar ? 'اسم المختبر (اختياري)' : 'Lab name (optional)'} value={labName} onChangeText={setLabName}/>
        <Text style={[ui.label,{textAlign:isRTL?'right':'left'}]}>{ar ? 'القيم الموجودة في التقرير فقط' : 'Only values present in the report'}</Text>
        <View style={styles.values}>{keys.map((key)=><View key={key} style={styles.valueField}><AccountField label={key} value={results[key] || ''} onChangeText={(value)=>setResults((current)=>({...current,[key]:value}))} keyboardType="decimal-pad" ltr/></View>)}</View>
        <AccountField label={ar ? 'ملاحظات' : 'Notes'} value={notes} onChangeText={setNotes} multiline/>
        <Notice text={ar ? 'إرفاق ملف المختبر يحتاج خدمة تخزين خارجية، وهي غير مفعلة حالياً.' : 'Attaching the lab document requires external storage, which is not configured yet.'}/>
        <AppButton label={ar ? 'حفظ التحليل' : 'Save analysis'} disabled={busy} onPress={save}/>
      </View> : null}
      {loading ? <FarmSkeleton/> : analyses.length ? <View style={farmUI.card}>{analyses.map((analysis)=><FarmRow key={analysis.id} icon={FlaskConical} title={`${analysis.type==='soil'?(ar?'تحليل تربة':'Soil analysis'):(ar?'تحليل مياه':'Water analysis')} · ${analysis.sampledAt}`} body={[analysis.labName,Object.entries(analysis.results).map(([key,value])=>`${key}: ${value}`).join(' · ')].filter(Boolean).join('\n')}/>)}</View> : <View style={styles.empty}><Plus size={22} color={colors.primary}/><Text style={farmUI.body}>{ar ? 'لا توجد تحاليل مسجلة.' : 'No analyses recorded.'}</Text></View>}
    </FarmSection>
  </AccountPage>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) { return <MotionPressable accessibilityRole="radio" accessibilityState={{checked:active}} onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></MotionPressable>; }
function MeasurementHistory({analyses,ar,rtl}:{analyses:AgriculturalAnalysis[];ar:boolean;rtl:boolean}){
  const series=(['pH','EC','salinity'] as const).map((key)=>({key,values:analyses.filter((item)=>Number.isFinite(item.results[key])).slice(0,8).map((item)=>({value:Number(item.results[key]),date:item.sampledAt,source:item.labName||(ar?'سجل يدوي':'Manual record')}))})).filter((item)=>item.values.length);
  if(!series.length)return <View style={styles.empty}><Text style={farmUI.body}>{ar?'لا توجد قيم pH أو EC أو ملوحة للرسم.':'No pH, EC, or salinity values to chart.'}</Text></View>;
  return <View style={styles.history}>{series.map((item)=>{const max=Math.max(...item.values.map((point)=>Math.abs(point.value)),1);return <View key={item.key} style={styles.series}><Text style={[styles.seriesTitle,{textAlign:rtl?'right':'left'}]}>{item.key}</Text>{item.values.map((point,index)=><View key={`${point.date}-${index}`} style={[styles.point,{flexDirection:rtl?'row-reverse':'row'}]}><Text style={styles.pointValue}>{point.value}</Text><View style={styles.track}><View style={[styles.fill,{width:`${Math.max(4,Math.min(100,Math.abs(point.value)/max*100))}%`}]} /></View><View style={styles.pointCopy}><Text numberOfLines={1} style={[styles.pointDate,{textAlign:rtl?'right':'left'}]}>{point.date}</Text><Text numberOfLines={1} style={[styles.pointSource,{textAlign:rtl?'right':'left'}]}>{point.source}</Text></View></View>)}</View>})}<Text style={[styles.historyNote,{textAlign:rtl?'right':'left'}]}>{ar?'مقارنة بصرية لسجلاتك فقط؛ الوحدات كما وردت في تقرير المختبر ولا يوجد تفسير علاجي.':'Visual comparison of your records only. Units remain as reported by the lab and no treatment interpretation is applied.'}</Text></View>;
}
const styles=StyleSheet.create({choices:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},choice:{minHeight:40,paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},choiceActive:{backgroundColor:colors.primary,borderColor:colors.primary},choiceText:{...typography.button,color:colors.text},choiceTextActive:{color:colors.surface},values:{flexDirection:'row',flexWrap:'wrap',gap:spacing.md},valueField:{width:'47%',minWidth:124,flexGrow:1},empty:{minHeight:92,backgroundColor:colors.surface,padding:spacing.lg,alignItems:'center',justifyContent:'center',gap:spacing.sm},history:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,gap:spacing.md},series:{gap:spacing.sm},seriesTitle:{...typography.button,color:colors.text},point:{alignItems:'center',gap:spacing.sm},pointValue:{...typography.caption,color:colors.primaryDark,width:48},track:{height:8,flex:1,minWidth:80,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,overflow:'hidden'},fill:{height:8,borderRadius:radius.pill,backgroundColor:colors.primary},pointCopy:{width:92,minWidth:0},pointDate:{fontSize:10,lineHeight:14,color:colors.text},pointSource:{fontSize:10,lineHeight:14,color:colors.muted},historyNote:{...typography.caption,color:colors.muted}});
