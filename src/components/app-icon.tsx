import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Compass,
  Film,
  House,
  Info,
  LogOut,
  Maximize2,
  Menu,
  MessageCircle,
  Minimize2,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Tv,
  UserRound,
  UsersRound,
  Video,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type AppIconName =
  | "activity"
  | "arrow-left"
  | "arrow-right"
  | "chart"
  | "check"
  | "chevron"
  | "clapper"
  | "close"
  | "discover"
  | "film"
  | "home"
  | "info"
  | "logout"
  | "maximize"
  | "menu"
  | "messages"
  | "minimize"
  | "moon"
  | "pencil"
  | "plus"
  | "settings"
  | "sparkles"
  | "star"
  | "sun"
  | "trash"
  | "tv"
  | "user"
  | "users"
  | "video"
  | "warning";

const icons: Record<AppIconName, LucideIcon> = {
  activity: Activity,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  chart: BarChart3,
  check: Check,
  chevron: ChevronRight,
  clapper: Clapperboard,
  close: X,
  discover: Compass,
  film: Film,
  home: House,
  info: Info,
  logout: LogOut,
  maximize: Maximize2,
  menu: Menu,
  messages: MessageCircle,
  minimize: Minimize2,
  moon: Moon,
  pencil: Pencil,
  plus: Plus,
  settings: Settings,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  trash: Trash2,
  tv: Tv,
  user: UserRound,
  users: UsersRound,
  video: Video,
  warning: CircleAlert,
};

export function AppIcon({
  name,
  ...props
}: LucideProps & { name: AppIconName }) {
  const Icon = icons[name];

  return <Icon aria-hidden="true" {...props} />;
}
