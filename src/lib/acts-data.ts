export const SPECIALTIES = ["هندسة كهربائية", "هندسة ميكانيكية", "هندسة اتصالات وشبكات", "هندسة تكنولوجيا المعلومات", "هندسة طاقة متجددة", "هندسة تحكم وأتمتة", "هندسة إلكترونيات", "هندسة صناعية", "هندسة ميكاترونكس"];
export const SERVICES = ["قياس الأحمال", "تركيب منظومات الطاقة", "الصيانة", "الاستشارات الهندسية", "التصميم والحسابات الهندسية", "برمجة أنظمة التحكم", "الإشراف الهندسي", "خدمات هندسية أخرى"];
export const REG_SERVICES = ["تصميم", "تنفيذ", "صيانة", "برمجة", "استشارات", "إشراف"];
export const GOVERNORATES = ["أمانة العاصمة", "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "حضرموت", "مأرب", "حجة", "عمران", "البيضاء", "لحج", "أبين", "شبوة", "المهرة", "الجوف", "صعدة", "المحويت", "ريمة", "الضالع", "سقطرى"];
export const REQ_STATUS: Record<string, string> = { new: "جديد", accepted: "مقبول", in_progress: "قيد التنفيذ", done: "مكتمل", cancelled: "ملغي" };
export const ENG_STATUS: Record<string, string> = { pending: "بانتظار الاعتماد", approved: "معتمد", rejected: "مرفوض", suspended: "موقوف" };
export const fileToB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
