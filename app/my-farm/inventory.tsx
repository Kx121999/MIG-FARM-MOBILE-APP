import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Package, Plus, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { AppIconButton } from '@/components/AppIconButton';
import { FarmRow, FarmSection, FarmSkeleton, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, spacing, typography } from '@/constants/theme';
import { farmService } from '@/services/farm';
import type { FarmInventoryItem } from '@/types/farm';

export default function FarmInventoryScreen() {
  const { farmId = '' } = useLocalSearchParams<{ farmId: string }>();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [items, setItems] = useState<FarmInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setError('');
    try { setItems(await farmService.inventory(farmId)); }
    catch { setError(ar ? 'تعذر تحميل المخزون.' : 'Could not load inventory.'); }
    finally { setLoading(false); }
  }, [farmId, ar]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!name.trim() || !category.trim()) return setError(ar ? 'اكتب اسم المنتج والقسم.' : 'Enter the product name and category.');
    const numericQuantity = quantity.trim() ? Number(quantity) : undefined;
    const numericMinimum = minimumQuantity.trim() ? Number(minimumQuantity) : undefined;
    if (numericQuantity !== undefined && (!Number.isFinite(numericQuantity) || numericQuantity < 0)) return setError(ar ? 'اكتب كمية صحيحة.' : 'Enter a valid quantity.');
    if (numericMinimum !== undefined && (!Number.isFinite(numericMinimum) || numericMinimum < 0)) return setError(ar ? 'اكتب حدًا أدنى صحيحًا.' : 'Enter a valid minimum quantity.');
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return setError(ar ? 'اكتب تاريخ الصلاحية بصيغة YYYY-MM-DD.' : 'Enter expiry as YYYY-MM-DD.');
    setBusy(true); setError('');
    try {
      await farmService.createInventoryItem({ farmId, productNameSnapshot: name.trim(), category: category.trim(), quantity: numericQuantity, minimumQuantity: numericMinimum, expiresAt: expiresAt || null, unit: unit.trim() || null, notes: notes.trim() });
      setName(''); setCategory(''); setQuantity(''); setMinimumQuantity(''); setExpiresAt(''); setUnit(''); setNotes(''); setAdding(false);
      await load();
    } catch { setError(ar ? 'تعذر حفظ العنصر.' : 'Could not save the item.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError('');
    try { await farmService.deleteInventoryItem(id); await load(); }
    catch { setError(ar ? 'تعذر حذف العنصر.' : 'Could not remove the item.'); }
    finally { setBusy(false); }
  };

  return <AccountPage title={ar ? 'مخزون المزرعة' : 'Farm inventory'}>
    <Notice text={ar ? 'يعرض التطبيق الكميات التي تسجلها أنت فقط. لا يتم احتساب الاستهلاك تلقائياً.' : 'Only quantities you record are shown. Consumption is not calculated automatically.'}/>
    {error ? <Notice error text={error}/> : null}
    <FarmSection title={ar ? 'العناصر المسجلة' : 'Recorded items'} action={adding ? (ar ? 'إلغاء' : 'Cancel') : (ar ? 'إضافة' : 'Add')} onAction={() => setAdding((value) => !value)}>
      {adding ? <View style={farmUI.card}>
        <AccountField label={ar ? 'اسم المنتج' : 'Product name'} value={name} onChangeText={setName}/>
        <AccountField label={ar ? 'القسم' : 'Category'} value={category} onChangeText={setCategory}/>
        <AccountField label={ar ? 'الكمية' : 'Quantity'} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad"/>
        <AccountField label={ar ? 'تنبيه عند كمية' : 'Low-stock threshold'} value={minimumQuantity} onChangeText={setMinimumQuantity} keyboardType="decimal-pad"/>
        <AccountField label={ar ? 'تاريخ الصلاحية' : 'Expiry date'} value={expiresAt} onChangeText={setExpiresAt} placeholder="YYYY-MM-DD" ltr/>
        <AccountField label={ar ? 'الوحدة' : 'Unit'} value={unit} onChangeText={setUnit}/>
        <AccountField label={ar ? 'ملاحظات' : 'Notes'} value={notes} onChangeText={setNotes} multiline/>
        <AppButton label={ar ? 'حفظ العنصر' : 'Save item'} disabled={busy} onPress={save}/>
      </View> : null}
      {loading ? <FarmSkeleton/> : items.length ? <View style={farmUI.card}>{items.map((item) => <FarmRow key={item.id} icon={item.status==='available'?Package:AlertTriangle} title={item.productNameSnapshot} body={[item.category, item.quantity === null ? '' : `${item.quantity} ${item.unit || ''}`.trim(), inventoryStatus(item.status,ar), item.expiresAt ? `${ar?'الصلاحية':'Expiry'}: ${item.expiresAt}` : ''].filter(Boolean).join(' · ')} trailing={<AppIconButton icon={Trash2} label={ar ? 'حذف العنصر' : 'Remove item'} onPress={() => { if (!busy) void remove(item.id); }}/>} />)}</View> : <View style={styles.empty}><Plus size={22} color={colors.primary}/><Text style={[styles.emptyText, { textAlign: isRTL ? 'right' : 'left' }]}>{ar ? 'لم تسجل أي مخزون بعد.' : 'No inventory has been recorded yet.'}</Text></View>}
    </FarmSection>
  </AccountPage>;
}

function inventoryStatus(status:FarmInventoryItem['status'],ar:boolean){if(status==='out_of_stock')return ar?'نفد المخزون':'Out of stock';if(status==='low_stock')return ar?'مخزون منخفض':'Low stock';if(status==='expiring_soon')return ar?'صلاحية قريبة':'Expiring soon';return '';}

const styles = StyleSheet.create({ empty:{minHeight:92,backgroundColor:colors.surface,padding:spacing.lg,alignItems:'center',justifyContent:'center',gap:spacing.sm},emptyText:{...typography.body,color:colors.muted}, });
