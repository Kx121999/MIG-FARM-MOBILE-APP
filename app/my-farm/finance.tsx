import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CircleDollarSign, ReceiptText, TrendingUp, WalletCards } from 'lucide-react-native';
import { AccountField, AccountPage, Notice, ui } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { MotionPressable } from '@/components/Motion';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { farmCommandService } from '@/services/farmCommand';
import type { FarmExpense, FarmSale } from '@/types/farm';

type Mode = 'expense'|'sale';
const categories = [
  ['seeds','بذور','Seeds'],['seedlings','شتلات','Seedlings'],['fertilizer','أسمدة','Fertilizer'],
  ['crop_protection','وقاية المحصول','Crop protection'],['water','مياه','Water'],['labor','عمالة','Labor'],
  ['transport','نقل','Transport'],['equipment','معدات','Equipment'],['energy','طاقة','Energy'],['other','أخرى','Other'],
];

export default function FarmFinanceScreen() {
  const params=useLocalSearchParams<{farmId?:string;cropId?:string;type?:Mode}>();
  const {dashboard,submit}=useFarm();
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const farmId=params.farmId||dashboard?.farms[0]?.id||'';
  const availableCrops=dashboard?.crops.filter((crop)=>crop.farmId===farmId)||[];
  const [mode,setMode]=useState<Mode>(params.type==='sale'?'sale':'expense');
  const [cropId,setCropId]=useState(params.cropId||availableCrops[0]?.id||'');
  const [expenses,setExpenses]=useState<FarmExpense[]>([]),[sales,setSales]=useState<FarmSale[]>([]);
  const [totalExpense,setTotalExpense]=useState(0),[totalSales,setTotalSales]=useState(0);
  const [category,setCategory]=useState('seeds'),[amount,setAmount]=useState(''),[quantity,setQuantity]=useState(''),[unit,setUnit]=useState('kg'),[unitPrice,setUnitPrice]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[notes,setNotes]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    if(!farmId)return;
    setLoading(true);
    try{
      const [expenseResult,saleResult]=await Promise.all([farmCommandService.expenses(farmId,cropId||undefined),farmCommandService.sales(farmId,cropId||undefined)]);
      setExpenses(expenseResult.expenses);setTotalExpense(expenseResult.totalMinor);setSales(saleResult.sales);setTotalSales(saleResult.revenueMinor);
    }catch{setNotice(ar?'تعذر تحميل السجل المالي.':'Could not load the financial records.');}
    finally{setLoading(false);}
  },[farmId,cropId,ar]);
  useEffect(()=>{void load();},[load]);

  const preview=useMemo(()=>Number(quantity||0)*Number(unitPrice||0),[quantity,unitPrice]);
  const save=async()=>{
    setNotice('');
    if(!farmId)return setNotice(ar?'اختر مزرعة أولاً.':'Choose a farm first.');
    if(mode==='expense'&&(!Number.isFinite(Number(amount))||Number(amount)<=0))return setNotice(ar?'اكتب مبلغًا صحيحًا.':'Enter a valid amount.');
    if(mode==='sale'&&(!cropId||!Number.isFinite(Number(quantity))||Number(quantity)<=0||!Number.isFinite(Number(unitPrice))||Number(unitPrice)<=0))return setNotice(ar?'اختر محصولًا واكتب كمية وسعرًا صحيحين.':'Choose a crop and enter valid quantity and price.');
    setBusy(true);
    try{
      const body=mode==='expense'?{farmId,cropCycleId:cropId||undefined,category,amount:Number(amount),currency:'AED',date,notes}:{farmId,cropCycleId:cropId,cropId,quantity:Number(quantity),unit:unit.trim()||'kg',unitPrice:Number(unitPrice),currency:'AED',date,buyerNotes:notes};
      const result=await submit(mode,body);
      setNotice(result==='queued'?(ar?'حُفظ السجل للمزامنة عند عودة الاتصال.':'Record saved for sync when online.'):(ar?'تم حفظ السجل المالي.':'Financial record saved.'));
      setAmount('');setQuantity('');setUnitPrice('');setNotes('');
      if(result==='saved')await load();
    }catch{setNotice(ar?'تعذر حفظ السجل.':'Could not save the record.');}
    finally{setBusy(false);}
  };

  if(!farmId)return <AccountPage title={ar?'المالية':'Finance'}><Notice text={ar?'أضف مزرعة أولاً لبدء السجل المالي.':'Add a farm before starting financial records.'}/></AccountPage>;
  return <AccountPage title={ar?'المصروفات والمبيعات':'Expenses and sales'}>
    <View style={[styles.summary,{flexDirection:isRTL?'row-reverse':'row'}]}><Summary icon={ReceiptText} label={ar?'المصروفات':'Expenses'} value={money(totalExpense)}/><Summary icon={TrendingUp} label={ar?'المبيعات':'Sales'} value={money(totalSales)}/><Summary icon={CircleDollarSign} label={ar?'الهامش الإجمالي':'Gross margin'} value={money(totalSales-totalExpense)}/></View>
    <Notice text={ar?'الأرقام مبنية على ما تسجله أنت فقط. لا توجد أسعار سوق أو إيرادات مفترضة.':'Figures use only your records. No market prices or assumed revenue are added.'}/>
    <View style={[styles.segment,{flexDirection:isRTL?'row-reverse':'row'}]}><Segment active={mode==='expense'} label={ar?'مصروف':'Expense'} onPress={()=>setMode('expense')}/><Segment active={mode==='sale'} label={ar?'بيع':'Sale'} onPress={()=>setMode('sale')}/></View>
    {availableCrops.length?<Select title={ar?'المحصول':'Crop'} items={availableCrops.map((crop)=>({value:crop.id,label:crop.cropName}))} value={cropId} onChange={setCropId} isRTL={isRTL} optional={mode==='expense'} ar={ar}/>:mode==='sale'?<Notice error text={ar?'أضف محصولًا قبل تسجيل المبيعات.':'Add a crop before recording sales.'}/>:null}
    <View style={farmUI.card}>
      {mode==='expense'?<><Select title={ar?'نوع المصروف':'Expense category'} items={categories.map((item)=>({value:item[0],label:ar?item[1]:item[2]}))} value={category} onChange={setCategory} isRTL={isRTL} ar={ar}/><AccountField label={ar?'المبلغ بالدرهم':'Amount (AED)'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" ltr/></>:<><AccountField label={ar?'الكمية':'Quantity'} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" ltr/><AccountField label={ar?'الوحدة':'Unit'} value={unit} onChangeText={setUnit}/><AccountField label={ar?'سعر الوحدة بالدرهم':'Unit price (AED)'} value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" ltr/><Text style={[styles.preview,{textAlign:isRTL?'right':'left'}]}>{ar?`إجمالي البيع: ${preview.toFixed(2)} درهم`:`Sale total: AED ${preview.toFixed(2)}`}</Text></>}
      <AccountField label={ar?'التاريخ':'Date'} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" ltr/>
      <AccountField label={ar?'ملاحظات':'Notes'} value={notes} onChangeText={setNotes} multiline/>
      {notice?<Notice text={notice}/>:null}
      <AppButton disabled={busy||mode==='sale'&&!availableCrops.length} label={busy?(ar?'جارٍ الحفظ...':'Saving...'):(ar?'حفظ السجل':'Save record')} onPress={save}/>
    </View>
    <FarmSection title={mode==='expense'?(ar?'المصروفات المسجلة':'Recorded expenses'):(ar?'المبيعات المسجلة':'Recorded sales')}>
      {loading?<FarmSkeleton/>:mode==='expense'?(expenses.length?<View style={farmUI.card}>{expenses.map((item)=><FarmRow key={item.id} icon={ReceiptText} title={categoryLabel(item.category,ar)} body={`${money(item.amountMinor)} · ${formatDate(item.occurredAt,ar)}`}/>)}</View>:<Empty ar={ar} mode={mode}/>):(sales.length?<View style={farmUI.card}>{sales.map((item)=><FarmRow key={item.id} icon={TrendingUp} title={`${item.quantity} ${item.unit}`} body={`${money(item.totalMinor)} · ${formatDate(item.soldAt,ar)}`}/>)}</View>:<Empty ar={ar} mode={mode}/>) }
    </FarmSection>
  </AccountPage>;
}

function Segment({active,label,onPress}:{active:boolean;label:string;onPress:()=>void}){return <MotionPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.segmentButton,active&&styles.segmentActive]}><Text style={[styles.segmentText,active&&styles.segmentTextActive]}>{label}</Text></MotionPressable>}
function Summary({icon:Icon,label,value}:{icon:typeof WalletCards;label:string;value:string}){return <View style={styles.summaryItem}><Icon size={19} color={colors.primary}/><Text style={styles.summaryLabel}>{label}</Text><Text numberOfLines={1} style={styles.summaryValue}>{value}</Text></View>}
function Select({title,items,value,onChange,isRTL,optional=false,ar}:{title:string;items:Array<{value:string;label:string}>;value:string;onChange:(value:string)=>void;isRTL:boolean;optional?:boolean;ar:boolean}){const all=optional?[{value:'',label:ar?'كل المزرعة':'Whole farm'},...items]:items;return <View style={styles.group}><Text style={[ui.label,{textAlign:isRTL?'right':'left'}]}>{title}</Text><View style={[styles.options,{flexDirection:isRTL?'row-reverse':'row'}]}>{all.map((item)=><MotionPressable key={item.value||'all'} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>onChange(item.value)} style={[styles.choice,value===item.value&&styles.choiceActive]}><Text style={[styles.choiceText,value===item.value&&styles.choiceTextActive]}>{item.label}</Text></MotionPressable>)}</View></View>}
function Empty({ar,mode}:{ar:boolean;mode:Mode}){return <View style={styles.empty}><WalletCards size={22} color={colors.primary}/><Text style={styles.emptyText}>{mode==='expense'?(ar?'لا توجد مصروفات مسجلة.':'No expenses recorded.'):(ar?'لا توجد مبيعات مسجلة.':'No sales recorded.')}</Text></View>}
function money(value:number){return `${(value/100).toFixed(2)} AED`}
function formatDate(value:string,ar:boolean){return new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value))}
function categoryLabel(value:string,ar:boolean){const item=categories.find((entry)=>entry[0]===value||({seed:'seeds',seedling:'seedlings',treatment:'crop_protection'} as Record<string,string>)[value]===entry[0]);return item?(ar?item[1]:item[2]):value}
const styles=StyleSheet.create({summary:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.sm,gap:spacing.xs,flexWrap:'wrap'},summaryItem:{flex:1,minWidth:98,padding:spacing.sm,gap:3},summaryLabel:{...typography.caption,color:colors.muted},summaryValue:{...typography.button,color:colors.primaryDark},segment:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,padding:3,gap:3},segmentButton:{flex:1,minHeight:42,borderRadius:radius.sm,alignItems:'center',justifyContent:'center'},segmentActive:{backgroundColor:colors.surface},segmentText:{...typography.button,color:colors.muted},segmentTextActive:{color:colors.primaryDark},group:{gap:spacing.sm},options:{flexWrap:'wrap',gap:spacing.sm},choice:{minHeight:38,paddingHorizontal:spacing.md,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,justifyContent:'center'},choiceActive:{backgroundColor:colors.primary},choiceText:{...typography.caption,color:colors.text},choiceTextActive:{color:colors.surface},preview:{...typography.button,color:colors.primaryDark},empty:{minHeight:96,alignItems:'center',justifyContent:'center',gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.md},emptyText:{...typography.body,color:colors.muted,textAlign:'center'}});
