import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccountField, AccountPage, Notice, ui } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { CustomerServiceError } from '@/services/apiClient';
import { farmService } from '@/services/farm';
import type { CropCycle, FarmZone } from '@/types/farm';

type Kind = 'task' | 'irrigation' | 'operation' | 'problem' | 'harvest' | 'note';
const labels: Record<Kind, { ar: string; en: string }> = {
  task: { ar: 'إضافة مهمة', en: 'Add task' },
  irrigation: { ar: 'تسجيل ري', en: 'Record irrigation' },
  operation: { ar: 'تسجيل عملية زراعية', en: 'Record farm operation' },
  problem: { ar: 'إضافة مشكلة', en: 'Add problem' },
  harvest: { ar: 'تسجيل حصاد', en: 'Record harvest' },
  note: { ar: 'إضافة ملاحظة', en: 'Add note' },
};

export default function QuickAdd() {
  const params = useLocalSearchParams<{ type?: Kind; farmId?: string; zoneId?: string; cropId?: string; problemId?: string; title?: string }>();
  const kind: Kind = params.type && labels[params.type] ? params.type : 'task';
  const { dashboard, submit } = useFarm();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [farmId, setFarmId] = useState(params.farmId || dashboard?.farms[0]?.id || '');
  const [zoneId, setZoneId] = useState(params.zoneId || '');
  const [cropId, setCropId] = useState(params.cropId || '');
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [crops, setCrops] = useState<CropCycle[]>([]);
  const [title, setTitle] = useState(params.title || '');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [subtype, setSubtype] = useState(defaultSubtype(kind));
  const [priority, setPriority] = useState('normal');
  const [recurrence, setRecurrence] = useState('none');
  const [duration, setDuration] = useState('');
  const [volume, setVolume] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(kind === 'harvest' ? 'kg' : '');
  const [customUnit, setCustomUnit] = useState('');
  const [product, setProduct] = useState('');
  const [severity, setSeverity] = useState('mild');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!farmId && dashboard?.farms[0]) setFarmId(dashboard.farms[0].id);
  }, [dashboard, farmId]);
  useEffect(() => {
    if (!farmId) return;
    Promise.all([farmService.zones(farmId), farmService.crops(farmId)])
      .then(([nextZones, nextCrops]) => {
        setZones(nextZones);
        setCrops(nextCrops);
        setZoneId((current) => current || nextZones[0]?.id || '');
        setCropId((current) => current || nextCrops.find((crop) => ['active', 'planted', 'harvesting'].includes(crop.status))?.id || '');
      })
      .catch(() => setError(ar ? 'تعذر تحميل المناطق والمحاصيل.' : 'Could not load zones and crops.'));
  }, [farmId, ar]);

  const save = async () => {
    if (!farmId) return setError(ar ? 'اختر مزرعة أولاً.' : 'Choose a farm first.');
    if (kind === 'irrigation' && !zoneId) return setError(ar ? 'سجل منطقة قبل تسجيل الري.' : 'Add a zone before recording irrigation.');
    if (kind === 'harvest' && (!cropId || !quantity)) return setError(ar ? 'اختر محصولاً واكتب كمية الحصاد.' : 'Choose a crop and enter the harvest quantity.');
    if (kind === 'harvest' && unit === 'custom' && !customUnit.trim()) return setError(ar ? 'اكتب اسم الوحدة المخصصة.' : 'Enter the custom unit name.');
    if ((kind === 'task' || kind === 'problem') && !title.trim()) return setError(ar ? 'اكتب العنوان.' : 'Enter a title.');
    if (kind === 'note' && !notes.trim()) return setError(ar ? 'اكتب الملاحظة.' : 'Enter the note.');
    setBusy(true);
    setError('');
    try {
      const common = { farmId, zoneId: zoneId || undefined, cropCycleId: cropId || undefined };
      let body: Record<string, unknown>;
      if (kind === 'task') body = { ...common, problemId: params.problemId || undefined, type: subtype, title: title.trim(), description: notes, dueAt: toISO(date), priority, recurrenceRule: recurrenceRule(recurrence) };
      else if (kind === 'irrigation') body = { ...common, startedAt: toISO(date), method: subtype, durationMinutes: duration ? Number(duration) : undefined, waterVolumeLiters: volume ? Number(volume) : undefined, notes };
      else if (kind === 'operation') body = { ...common, type: subtype, performedAt: toISO(date), productNameSnapshot: product || undefined, quantity: quantity ? Number(quantity) : undefined, unit: unit || undefined, notes };
      else if (kind === 'problem') body = { ...common, category: subtype, title: title.trim(), description: notes, severity, firstObservedAt: toISO(date) };
      else if (kind === 'harvest') body = { ...common, cropCycleId: cropId, harvestedAt: toISO(date), quantity: Number(quantity), unit, customUnit: unit === 'custom' ? customUnit.trim() : undefined, qualityNotes: notes };
      else body = { ...common, problemId: params.problemId || undefined, body: notes.trim() };
      await submit(kind, body);
      router.back();
    } catch (e) {
      setError(e instanceof CustomerServiceError && e.code === 'network'
        ? (ar ? 'لا يوجد اتصال. حاول مرة أخرى ليتم حفظها للمزامنة.' : 'No connection. Try again to queue the record.')
        : (ar ? 'راجع البيانات المطلوبة وحاول مرة أخرى.' : 'Check the required details and try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!dashboard?.farms.length) return <AccountPage title={labels[kind][ar ? 'ar' : 'en']}><Notice text={ar ? 'أضف مزرعة أولاً قبل إنشاء السجلات.' : 'Add a farm before creating records.'}/><AppButton label={ar ? 'إضافة مزرعة' : 'Add farm'} onPress={() => router.replace('/my-farm/farm-form')}/></AccountPage>;
  const subtypeOptions = options(kind).map((option) => ({ value: option[0], label: ar ? option[1] : option[2] }));
  return <AccountPage title={labels[kind][ar ? 'ar' : 'en']}>
    <Select title={ar ? 'المزرعة' : 'Farm'} items={dashboard.farms.map((farm) => ({ value: farm.id, label: farm.name }))} value={farmId} onChange={setFarmId} isRTL={isRTL}/>
    {zones.length && kind !== 'note' ? <Select title={ar ? 'المنطقة' : 'Zone'} items={zones.map((zone) => ({ value: zone.id, label: zone.name }))} value={zoneId} onChange={setZoneId} isRTL={isRTL}/> : null}
    {crops.length && ['task', 'irrigation', 'operation', 'problem', 'harvest'].includes(kind) ? <Select title={ar ? 'المحصول' : 'Crop'} items={[{ value: '', label: ar ? 'بدون محصول محدد' : 'No specific crop' }, ...crops.map((crop) => ({ value: crop.id, label: crop.cropName + (crop.variety ? ` · ${crop.variety}` : ''), disabled: kind === 'harvest' && crop.status === 'completed' }))]} value={cropId} onChange={setCropId} isRTL={isRTL}/> : null}
    {subtypeOptions.length ? <Select title={kind === 'problem' ? (ar ? 'نوع المشكلة' : 'Problem category') : kind === 'irrigation' ? (ar ? 'طريقة الري' : 'Irrigation method') : (ar ? 'نوع السجل' : 'Record type')} items={subtypeOptions} value={subtype} onChange={setSubtype} isRTL={isRTL}/> : null}
    {kind === 'task' || kind === 'problem' ? <AccountField label={ar ? 'العنوان' : 'Title'} value={title} onChangeText={setTitle}/> : null}
    <AccountField label={kind === 'note' ? (ar ? 'الملاحظة' : 'Note') : (ar ? 'التاريخ والوقت' : 'Date and time')} value={kind === 'note' ? notes : date} onChangeText={kind === 'note' ? setNotes : setDate} ltr={kind !== 'note'} multiline={kind === 'note'} placeholder={kind === 'note' ? '' : 'YYYY-MM-DDTHH:mm'}/>
    {kind === 'task' ? <><Select title={ar ? 'الأولوية' : 'Priority'} items={[{value:'normal',label:ar?'عادية':'Normal'},{value:'important',label:ar?'مهمة':'Important'},{value:'urgent',label:ar?'عاجلة':'Urgent'}]} value={priority} onChange={setPriority} isRTL={isRTL}/><Select title={ar ? 'التكرار' : 'Repeat'} items={[{value:'none',label:ar?'بدون تكرار':'No repeat'},{value:'daily',label:ar?'يومياً':'Daily'},{value:'three_days',label:ar?'كل 3 أيام':'Every 3 days'},{value:'weekly',label:ar?'أسبوعياً':'Weekly'}]} value={recurrence} onChange={setRecurrence} isRTL={isRTL}/></> : null}
    {kind === 'irrigation' ? <><AccountField label={ar ? 'المدة بالدقائق' : 'Duration (minutes)'} value={duration} onChangeText={setDuration} keyboardType="number-pad" ltr/><AccountField label={ar ? 'الحجم باللتر' : 'Volume (liters)'} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" ltr/></> : null}
    {kind === 'operation' || kind === 'harvest' ? <AccountField label={ar ? 'الكمية' : 'Quantity'} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" ltr/> : null}
    {kind === 'operation' ? <AccountField label={ar ? 'الوحدة' : 'Unit'} value={unit} onChangeText={setUnit} ltr/> : null}
    {kind === 'harvest' ? <><Select title={ar ? 'وحدة الحصاد' : 'Harvest unit'} items={[{value:'kg',label:ar?'كجم':'kg'},{value:'ton',label:ar?'طن':'ton'},{value:'box',label:ar?'صندوق':'box'},{value:'piece',label:ar?'قطعة':'piece'},{value:'custom',label:ar?'وحدة مخصصة':'custom'}]} value={unit} onChange={setUnit} isRTL={isRTL}/>{unit === 'custom' ? <AccountField label={ar ? 'اسم الوحدة المخصصة' : 'Custom unit name'} value={customUnit} onChangeText={setCustomUnit}/> : null}</> : null}
    {kind === 'operation' ? <AccountField label={ar ? 'اسم المنتج المستخدم' : 'Product used'} value={product} onChangeText={setProduct}/> : null}
    {kind === 'problem' ? <Select title={ar ? 'الشدة حسب ملاحظتك' : 'Severity you observed'} items={[{value:'mild',label:ar?'خفيفة':'Mild'},{value:'medium',label:ar?'متوسطة':'Medium'},{value:'severe',label:ar?'شديدة':'Severe'}]} value={severity} onChange={setSeverity} isRTL={isRTL}/> : null}
    {kind !== 'note' ? <AccountField label={ar ? 'ملاحظات' : 'Notes'} value={notes} onChangeText={setNotes} multiline/> : null}
    {kind === 'irrigation' ? <Notice text={ar ? 'سجّل القيم الفعلية فقط. التطبيق لا يحسب أو يخمن كمية المياه.' : 'Record actual values only. The app does not calculate or guess water needs.'}/> : kind === 'operation' && subtype === 'fertilization' ? <Notice text={ar ? 'هذه جرعة مسجلة بواسطتك وليست توصية من MIG FARM.' : 'This is a user-recorded amount, not a MIG FARM recommendation.'}/> : kind === 'problem' ? <Notice text={ar ? 'اختيار الشدة لا يمثل تشخيصاً آلياً.' : 'The selected severity is not an automatic diagnosis.'}/> : null}
    {error ? <Notice error text={error}/> : null}
    <AppButton disabled={busy} label={busy ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ السجل' : 'Save record')} onPress={save}/>
  </AccountPage>;
}

function Select({ title, items, value, onChange, isRTL }: { title:string; items:Array<{value:string;label:string;disabled?:boolean}>; value:string; onChange:(value:string)=>void; isRTL:boolean }) {
  return <View style={styles.group}><Text style={[ui.label, { textAlign:isRTL ? 'right' : 'left' }]}>{title}</Text><View style={[styles.choices, { flexDirection:isRTL ? 'row-reverse' : 'row' }]}>{items.map((item) => <MotionPressable disabled={item.disabled} key={item.value || 'empty'} onPress={() => onChange(item.value)} style={[styles.choice, value === item.value && styles.active, item.disabled && styles.disabled]}><Text numberOfLines={2} style={[styles.choiceText, value === item.value && styles.activeText]}>{item.label}</Text></MotionPressable>)}</View></View>;
}
function defaultSubtype(kind: Kind) { return { task:'custom', irrigation:'drip', operation:'inspection', problem:'crop', harvest:'', note:'' }[kind]; }
function recurrenceRule(value:string) { return value === 'none' ? null : value === 'daily' ? {frequency:'daily'} : value === 'weekly' ? {frequency:'weekly'} : {frequency:'interval_days',interval:3}; }
function toISO(value:string) { const parsed=new Date(value); if(Number.isNaN(parsed.getTime())) throw new CustomerServiceError('invalid_input',400); return parsed.toISOString(); }
function options(kind:Kind):string[][] {
  if(kind==='task') return [['irrigation','ري','Irrigation'],['fertilization','تسميد','Fertilization'],['crop_inspection','فحص محصول','Crop inspection'],['pest_inspection','فحص آفات','Pest inspection'],['maintenance','صيانة','Maintenance'],['harvest','حصاد','Harvest'],['custom','أخرى','Custom']];
  if(kind==='irrigation') return [['drip','تنقيط','Drip'],['sprinkler','رشاشات','Sprinkler'],['manual','يدوي','Manual'],['pivot','محوري','Pivot'],['other','أخرى','Other']];
  if(kind==='operation') return [['irrigation','ري','Irrigation'],['fertilization','تسميد','Fertilization'],['spraying','معاملة','Treatment'],['pruning','تقليم','Pruning'],['harvest','حصاد','Harvest'],['inspection','فحص','Inspection'],['planting','زراعة','Planting'],['maintenance','صيانة','Maintenance'],['other','أخرى','Other']];
  if(kind==='problem') return [['crop','المحصول','Crop'],['soil','التربة','Soil'],['irrigation','الري','Irrigation'],['water','المياه','Water'],['pest','آفات','Pests'],['disease','أمراض','Diseases'],['nutrition','تغذية','Nutrition'],['growth','نمو','Growth'],['equipment','معدات','Equipment'],['other','أخرى','Other']];
  return [];
}
const styles=StyleSheet.create({group:{gap:spacing.sm},choices:{flexWrap:'wrap',gap:spacing.sm},choice:{minHeight:42,maxWidth:'100%',paddingHorizontal:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},active:{backgroundColor:colors.primary,borderColor:colors.primary},disabled:{opacity:.4},choiceText:{...typography.button,color:colors.text,textAlign:'center'},activeText:{color:colors.surface}});
