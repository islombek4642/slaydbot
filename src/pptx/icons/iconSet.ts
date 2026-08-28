import type { IconType } from "react-icons";
import {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaUsers,
  FaLightbulb,
  FaRocket,
  FaCheckCircle,
  FaCog,
  FaGlobe,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBullseye,
  FaHandshake,
  FaShieldAlt,
  FaGraduationCap,
  FaStar,
} from "react-icons/fa";

export const ICON_SET: Record<string, IconType> = {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaUsers,
  FaLightbulb,
  FaRocket,
  FaCheckCircle,
  FaCog,
  FaGlobe,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBullseye,
  FaHandshake,
  FaShieldAlt,
  FaGraduationCap,
  FaStar,
};

export type IconName = keyof typeof ICON_SET;
export const ICON_NAMES = Object.keys(ICON_SET) as IconName[];
