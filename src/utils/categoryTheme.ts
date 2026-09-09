import { 
  Fuel,
  Truck,
  Coffee,
  Wallet,
  Pill,
  Crown,
  Building2,
  ShoppingCart,
  FileText,
  Zap,
  Wifi,
  Smartphone,
  Wrench,
  Plane,
  Home,
  Gift,
  Sparkles,
  Bot,
  Landmark,
  Shield,
  Tag
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CategoryTheme {
  Icon: LucideIcon;
  bg: string;
  border: string;
  iconGradient: string;
  glow: string;
}

/**
 * Universal display label for categories.
 *
 * An advance can land in the ledger with two different category names -
 * 'salary-advance' (created by the MD approval flow) or 'Labour Advance'
 * (chosen in the petty-cash form) - but both mean exactly the same thing.
 * Showing them as two separate categories confuses MD and staff, so every
 * screen renders the single label "SALARY ADVANCE". How the advance was
 * authorised is shown separately in the Advance Type / Authorisation details.
 */
export const getCategoryLabel = (categoryName: string = ''): string => {
  const name = (categoryName || '').toLowerCase().trim();
  if (!name) return 'MISCELLANEOUS';
  if (name === 'salary-advance' || name.includes('advance')) return 'SALARY ADVANCE';
  return categoryName.replace(/[-_]/g, ' ').toUpperCase();
};

/**
 * Universal emoji resolver for categories across dropdowns, tables, and badges.
 */
export const getCategoryEmoji = (categoryName: string = ''): string => {
  const name = (categoryName || '').toLowerCase().trim();
  if (!name) return '🏷️';

  // Fuel / Petrol / Diesel / Bike / Scooter / Vehicle Fuel
  if (name.includes('petrol') || name.includes('fuel') || name.includes('diesel') || name.includes('gas') || name.includes('bike') || name.includes('scooter') || name.includes('cng')) {
    return '⛽';
  }

  // Staff Welfare / Food / Tea / Coffee / Snacks / Lunch / Mess / Refreshment / Water / Kitchen
  if (name.includes('welfare') || name.includes('tea') || name.includes('coffee') || name.includes('snack') || name.includes('food') || name.includes('lunch') || name.includes('dinner') || name.includes('breakfast') || name.includes('kitchen') || name.includes('mess') || name.includes('refreshment') || name.includes('pantry') || name.includes('water')) {
    return '☕';
  }

  // Porter / Vehicle Transport / Freight / Truck / Tempo / Delivery / Auto / Courier / Logistics
  if (name.includes('porter') || name.includes('vehicle') || name.includes('transport') || name.includes('freight') || name.includes('truck') || name.includes('tempo') || name.includes('delivery') || name.includes('auto') || name.includes('logistics') || name.includes('cargo')) {
    return '🚚';
  }

  // Sir Expenses / MD / Boss / Owner / Director / Executive / Management
  if (name.includes('sir') || name.includes('md') || name.includes('owner') || name.includes('boss') || name.includes('director') || name.includes('executive') || name.includes('management')) {
    return '👑';
  }

  // Salary Advance / Wage / Labour / Worker / Staff / Cash / Money / Payout / Bonus
  if (name.includes('salary') || name.includes('advance') || name.includes('wage') || name.includes('bonus') || name.includes('cash') || name.includes('money') || name.includes('payout') || name.includes('kharcha') || name.includes('staff pay')) {
    return '💼';
  }

  // Medicine / Medical / Health / Pharmacy / Doctor / Clinic / First Aid
  if (name.includes('medicine') || name.includes('medical') || name.includes('tablet') || name.includes('health') || name.includes('pharma') || name.includes('doctor') || name.includes('clinic') || name.includes('hospital') || name.includes('dawa')) {
    return '💊';
  }

  // AI Tools / ChatGPT / Claude / OpenAI / Bot / Software / IT / Tech
  if (name.includes('chatgpt') || name.includes('claude') || name.includes('openai') || name.includes('ai') || name.includes('gpt') || name.includes('bot') || name.includes('software') || name.includes('server') || name.includes('cloud') || name.includes('api') || name.includes('anthropic')) {
    return '🤖';
  }

  // Company Expenses / Office / Business / Corporate / Admin / Firm
  if (name.includes('company') || name.includes('office') || name.includes('corporate') || name.includes('firm') || name.includes('business') || name.includes('admin')) {
    return '🏢';
  }

  // Flipkart / Amazon / Shopping / Purchases / Store / Market / Goods / Material
  if (name.includes('flipkart') || name.includes('amazon') || name.includes('meesho') || name.includes('myntra') || name.includes('shopping') || name.includes('purchase') || name.includes('store') || name.includes('order') || name.includes('market') || name.includes('goods') || name.includes('material')) {
    return '🛒';
  }

  // Stationery / Paper / Print / Books / Pen / Xerox / Copy / Stamp / Post
  if (name.includes('stationery') || name.includes('paper') || name.includes('print') || name.includes('book') || name.includes('pen') || name.includes('xerox') || name.includes('copy') || name.includes('stamp') || name.includes('post') || name.includes('courier')) {
    return '📄';
  }

  // Electricity / Power / Light / Current / Energy / Bill / Utility / Bijli
  if (name.includes('electric') || name.includes('power') || name.includes('light') || name.includes('bill') || name.includes('energy') || name.includes('bijli') || name.includes('utility')) {
    return '⚡';
  }

  // Wifi / Internet / Broadband / Network / Telecom
  if (name.includes('wifi') || name.includes('internet') || name.includes('broadband') || name.includes('network') || name.includes('router') || name.includes('fiber')) {
    return '🌐';
  }

  // Phone / Mobile / Recharge / Sim / Call / Telephone
  if (name.includes('phone') || name.includes('mobile') || name.includes('recharge') || name.includes('sim') || name.includes('call') || name.includes('telephone')) {
    return '📱';
  }

  // Repair / Maintenance / Hardware / Plumbing / Service / Tools / Carpenter / AC / Electrician
  if (name.includes('repair') || name.includes('maintenance') || name.includes('hardware') || name.includes('service') || name.includes('tools') || name.includes('plumbing') || name.includes('carpenter') || name.includes('ac ') || name.includes('servicing')) {
    return '🛠️';
  }

  // Rent / Room / Godown / Warehouse / Building / Lease / Flat / Property
  if (name.includes('rent') || name.includes('room') || name.includes('lease') || name.includes('godown') || name.includes('warehouse') || name.includes('property') || name.includes('flat') || name.includes('shed') || name.includes('shop')) {
    return '🏠';
  }

  // Travel / Flight / Ticket / Train / Bus / Hotel / Tour / Lodge
  if (name.includes('travel') || name.includes('flight') || name.includes('ticket') || name.includes('bus') || name.includes('train') || name.includes('tour') || name.includes('hotel') || name.includes('stay') || name.includes('lodge') || name.includes('railway')) {
    return '✈️';
  }

  // Gift / Festival / Celebration / Puja / Party / Bonus / Sweet / Donation
  if (name.includes('gift') || name.includes('festival') || name.includes('puja') || name.includes('pooja') || name.includes('party') || name.includes('celebration') || name.includes('sweet') || name.includes('donation') || name.includes('diwali') || name.includes('eid') || name.includes('holi')) {
    return '🎁';
  }

  // Bank / Tax / GST / CA / Finance / Legal / Audit / Penalty / Fee
  if (name.includes('bank') || name.includes('tax') || name.includes('gst') || name.includes('ca ') || name.includes('audit') || name.includes('legal') || name.includes('fee') || name.includes('fine') || name.includes('penalty') || name.includes('interest') || name.includes('challan')) {
    return '🏦';
  }

  // Cleaning / Housekeeping / Sanitation / Garbage / Waste / Wash / Soap / Detergent
  if (name.includes('clean') || name.includes('housekeeping') || name.includes('sanitat') || name.includes('garbage') || name.includes('waste') || name.includes('wash') || name.includes('soap') || name.includes('detergent') || name.includes('sweeper')) {
    return '🧹';
  }

  // Security / Guard / CCTV / Safety
  if (name.includes('security') || name.includes('guard') || name.includes('cctv') || name.includes('safety') || name.includes('watchman')) {
    return '🛡️';
  }

  // Miscellaneous / General / Other / Misc
  if (name.includes('misc') || name.includes('other') || name.includes('general') || name.includes('sundry') || name.includes('extra')) {
    return '✨';
  }

  return '🏷️';
};

/**
 * Smart theme resolver with category-matching icons and vivid gradient backgrounds.
 */
export const getCategoryTheme = (categoryName: string, index: number = 0): CategoryTheme => {
  const name = (categoryName || '').toLowerCase().trim();

  // Petrol / Fuel / Bike / Scooter
  if (name.includes('petrol') || name.includes('fuel') || name.includes('diesel') || name.includes('gas') || name.includes('bike') || name.includes('scooter') || name.includes('cng')) {
    return {
      Icon: Fuel,
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(234, 88, 12, 0.05) 100%)',
      border: 'rgba(245, 158, 11, 0.35)',
      iconGradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
      glow: 'rgba(245, 158, 11, 0.22)'
    };
  }

  // Staff Welfare / Food / Tea / Snacks
  if (name.includes('welfare') || name.includes('tea') || name.includes('coffee') || name.includes('snack') || name.includes('food') || name.includes('lunch') || name.includes('kitchen') || name.includes('mess') || name.includes('refreshment') || name.includes('pantry') || name.includes('water')) {
    return {
      Icon: Coffee,
      bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.10) 0%, rgba(244, 63, 94, 0.05) 100%)',
      border: 'rgba(236, 72, 153, 0.35)',
      iconGradient: 'linear-gradient(135deg, #ec4899 0%, #e11d48 100%)',
      glow: 'rgba(236, 72, 153, 0.22)'
    };
  }

  // Porter / Transport / Logistics / Tempo
  if (name.includes('porter') || name.includes('vehicle') || name.includes('transport') || name.includes('freight') || name.includes('truck') || name.includes('tempo') || name.includes('delivery') || name.includes('auto') || name.includes('logistics') || name.includes('cargo')) {
    return {
      Icon: Truck,
      bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.10) 0%, rgba(2, 132, 199, 0.05) 100%)',
      border: 'rgba(14, 165, 233, 0.35)',
      iconGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      glow: 'rgba(14, 165, 233, 0.22)'
    };
  }

  // Sir Expenses / MD / Executive / Boss
  if (name.includes('sir') || name.includes('md') || name.includes('owner') || name.includes('boss') || name.includes('director') || name.includes('executive') || name.includes('management')) {
    return {
      Icon: Crown,
      bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.10) 0%, rgba(168, 85, 247, 0.05) 100%)',
      border: 'rgba(139, 92, 246, 0.35)',
      iconGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      glow: 'rgba(139, 92, 246, 0.22)'
    };
  }

  // Salary Advance / Wage / Cash / Bonus
  if (name.includes('salary') || name.includes('advance') || name.includes('wage') || name.includes('bonus') || name.includes('cash') || name.includes('money') || name.includes('payout') || name.includes('kharcha')) {
    return {
      Icon: Wallet,
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10) 0%, rgba(5, 150, 105, 0.05) 100%)',
      border: 'rgba(16, 185, 129, 0.35)',
      iconGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      glow: 'rgba(16, 185, 129, 0.22)'
    };
  }

  // Medicine / Medical / Health / Pharmacy
  if (name.includes('medicine') || name.includes('medical') || name.includes('tablet') || name.includes('health') || name.includes('pharma') || name.includes('doctor') || name.includes('clinic') || name.includes('hospital') || name.includes('dawa')) {
    return {
      Icon: Pill,
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.10) 0%, rgba(220, 38, 38, 0.05) 100%)',
      border: 'rgba(239, 68, 68, 0.35)',
      iconGradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      glow: 'rgba(239, 68, 68, 0.22)'
    };
  }

  // ChatGPT / Claude / AI / Software / IT
  if (name.includes('chatgpt') || name.includes('claude') || name.includes('openai') || name.includes('ai') || name.includes('gpt') || name.includes('bot') || name.includes('software') || name.includes('server') || name.includes('cloud') || name.includes('anthropic')) {
    return {
      Icon: Bot,
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10) 0%, rgba(6, 182, 212, 0.05) 100%)',
      border: 'rgba(16, 185, 129, 0.35)',
      iconGradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
      glow: 'rgba(16, 185, 129, 0.22)'
    };
  }

  // Company Expenses / Office / Business
  if (name.includes('company') || name.includes('office') || name.includes('corporate') || name.includes('firm') || name.includes('business') || name.includes('admin')) {
    return {
      Icon: Building2,
      bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.10) 0%, rgba(79, 70, 229, 0.05) 100%)',
      border: 'rgba(99, 102, 241, 0.35)',
      iconGradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      glow: 'rgba(99, 102, 241, 0.22)'
    };
  }

  // Flipkart / Amazon / Shopping / Purchases
  if (name.includes('flipkart') || name.includes('amazon') || name.includes('meesho') || name.includes('myntra') || name.includes('shopping') || name.includes('purchase') || name.includes('store') || name.includes('order') || name.includes('market') || name.includes('goods') || name.includes('material')) {
    return {
      Icon: ShoppingCart,
      bg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.10) 0%, rgba(234, 88, 12, 0.05) 100%)',
      border: 'rgba(249, 115, 22, 0.35)',
      iconGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      glow: 'rgba(249, 115, 22, 0.22)'
    };
  }

  // Stationery / Paper / Print / Books
  if (name.includes('stationery') || name.includes('paper') || name.includes('print') || name.includes('book') || name.includes('pen') || name.includes('xerox') || name.includes('copy') || name.includes('stamp') || name.includes('post') || name.includes('courier')) {
    return {
      Icon: FileText,
      bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.10) 0%, rgba(13, 148, 136, 0.05) 100%)',
      border: 'rgba(20, 184, 166, 0.35)',
      iconGradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
      glow: 'rgba(20, 184, 166, 0.22)'
    };
  }

  // Electricity / Power / Current / Utility
  if (name.includes('electric') || name.includes('power') || name.includes('light') || name.includes('bill') || name.includes('energy') || name.includes('bijli') || name.includes('utility')) {
    return {
      Icon: Zap,
      bg: 'linear-gradient(135deg, rgba(234, 179, 8, 0.10) 0%, rgba(202, 138, 4, 0.05) 100%)',
      border: 'rgba(234, 179, 8, 0.35)',
      iconGradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
      glow: 'rgba(234, 179, 8, 0.22)'
    };
  }

  // Wifi / Internet
  if (name.includes('wifi') || name.includes('internet') || name.includes('broadband') || name.includes('network') || name.includes('router') || name.includes('fiber')) {
    return {
      Icon: Wifi,
      bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.10) 0%, rgba(8, 145, 178, 0.05) 100%)',
      border: 'rgba(6, 182, 212, 0.35)',
      iconGradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      glow: 'rgba(6, 182, 212, 0.22)'
    };
  }

  // Phone / Mobile / Recharge
  if (name.includes('phone') || name.includes('mobile') || name.includes('recharge') || name.includes('sim') || name.includes('call') || name.includes('telephone')) {
    return {
      Icon: Smartphone,
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, rgba(37, 99, 235, 0.05) 100%)',
      border: 'rgba(59, 130, 246, 0.35)',
      iconGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      glow: 'rgba(59, 130, 246, 0.22)'
    };
  }

  // Repair / Maintenance / Hardware / Plumbing
  if (name.includes('repair') || name.includes('maintenance') || name.includes('hardware') || name.includes('service') || name.includes('tools') || name.includes('plumbing') || name.includes('carpenter') || name.includes('ac ') || name.includes('servicing')) {
    return {
      Icon: Wrench,
      bg: 'linear-gradient(135deg, rgba(100, 116, 139, 0.10) 0%, rgba(71, 85, 105, 0.05) 100%)',
      border: 'rgba(100, 116, 139, 0.35)',
      iconGradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
      glow: 'rgba(100, 116, 139, 0.22)'
    };
  }

  // Rent / Room / Warehouse / Godown
  if (name.includes('rent') || name.includes('room') || name.includes('lease') || name.includes('godown') || name.includes('warehouse') || name.includes('property') || name.includes('flat') || name.includes('shed') || name.includes('shop')) {
    return {
      Icon: Home,
      bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.10) 0%, rgba(147, 51, 234, 0.05) 100%)',
      border: 'rgba(168, 85, 247, 0.35)',
      iconGradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
      glow: 'rgba(168, 85, 247, 0.22)'
    };
  }

  // Travel / Tour / Hotel
  if (name.includes('travel') || name.includes('flight') || name.includes('ticket') || name.includes('bus') || name.includes('train') || name.includes('tour') || name.includes('hotel') || name.includes('stay') || name.includes('lodge') || name.includes('railway')) {
    return {
      Icon: Plane,
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, rgba(37, 99, 235, 0.05) 100%)',
      border: 'rgba(59, 130, 246, 0.35)',
      iconGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      glow: 'rgba(59, 130, 246, 0.22)'
    };
  }

  // Gift / Festival / Celebration
  if (name.includes('gift') || name.includes('festival') || name.includes('puja') || name.includes('pooja') || name.includes('party') || name.includes('celebration') || name.includes('sweet') || name.includes('donation') || name.includes('diwali') || name.includes('eid') || name.includes('holi')) {
    return {
      Icon: Gift,
      bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.10) 0%, rgba(225, 29, 72, 0.05) 100%)',
      border: 'rgba(244, 63, 94, 0.35)',
      iconGradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      glow: 'rgba(244, 63, 94, 0.22)'
    };
  }

  // Bank / Tax / GST / CA / Finance / Legal
  if (name.includes('bank') || name.includes('tax') || name.includes('gst') || name.includes('ca ') || name.includes('audit') || name.includes('legal') || name.includes('fee') || name.includes('fine') || name.includes('penalty') || name.includes('interest') || name.includes('challan')) {
    return {
      Icon: Landmark,
      bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.10) 0%, rgba(180, 83, 9, 0.05) 100%)',
      border: 'rgba(217, 119, 6, 0.35)',
      iconGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      glow: 'rgba(217, 119, 6, 0.22)'
    };
  }

  // Security / Guard / Safety
  if (name.includes('security') || name.includes('guard') || name.includes('cctv') || name.includes('safety') || name.includes('watchman')) {
    return {
      Icon: Shield,
      bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.10) 0%, rgba(79, 70, 229, 0.05) 100%)',
      border: 'rgba(99, 102, 241, 0.35)',
      iconGradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      glow: 'rgba(99, 102, 241, 0.22)'
    };
  }

  // Miscellaneous / General / Other
  if (name.includes('misc') || name.includes('other') || name.includes('general') || name.includes('sundry') || name.includes('extra')) {
    return {
      Icon: Sparkles,
      bg: 'linear-gradient(135deg, rgba(217, 70, 239, 0.10) 0%, rgba(192, 38, 211, 0.05) 100%)',
      border: 'rgba(217, 70, 239, 0.35)',
      iconGradient: 'linear-gradient(135deg, #d946ef 0%, #c026d3 100%)',
      glow: 'rgba(217, 70, 239, 0.22)'
    };
  }

  // Fallback round-robin palette with distinct icons
  const fallbacks: CategoryTheme[] = [
    { Icon: Tag, bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.10) 0%, rgba(139, 92, 246, 0.05) 100%)', border: 'rgba(99, 102, 241, 0.35)', iconGradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', glow: 'rgba(99, 102, 241, 0.2)' },
    { Icon: Sparkles, bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10) 0%, rgba(5, 150, 105, 0.05) 100%)', border: 'rgba(16, 185, 129, 0.35)', iconGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', glow: 'rgba(16, 185, 129, 0.2)' },
    { Icon: Gift, bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.10) 0%, rgba(244, 63, 94, 0.05) 100%)', border: 'rgba(236, 72, 153, 0.35)', iconGradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', glow: 'rgba(236, 72, 153, 0.2)' },
    { Icon: Smartphone, bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(234, 88, 12, 0.05) 100%)', border: 'rgba(245, 158, 11, 0.35)', iconGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245, 158, 11, 0.2)' },
    { Icon: Tag, bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.10) 0%, rgba(2, 132, 199, 0.05) 100%)', border: 'rgba(14, 165, 233, 0.35)', iconGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', glow: 'rgba(14, 165, 233, 0.2)' },
  ];
  return fallbacks[index % fallbacks.length];
};
