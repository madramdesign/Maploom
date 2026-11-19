import type { AreaKind, RoadClass, StyleId } from '@maploom/core';
import type { FontKey } from './fonts';

/**
 * A MapStyle is pure presentation: it never touches geography. The same
 * Geography + Design rendered with two styles differ only in looks.
 * All lengths are "art units": the artwork's short edge is always 1000.
 */
export interface MapStyle {
  id: StyleId;
  name: string;
  tagline: string;
  fonts: { display: FontKey; label: FontKey; displayTracking: number; labelTracking: number; displayUpper: boolean; labelUpper: boolean; labelSize: number };
  colors: {
    paper: string;
    land: string;
    ink: string;
    areas: Partial<Record<AreaKind, string>>;
    areaStroke: string | null;
    water: string;
    waterStroke: string | null;
    waterDetail: string;
    buildings: string[];
    buildingStroke: string | null;
    buildingShadow: string | null;
    roadMajor: string;
    roadMinor: string;
    roadCasing: string | null;
    centerLine: string | null;
    rail: string;
    path: string;
    roadLabel: string;
    roadLabelHalo: string;
    label: string;
    labelHalo: string;
    tree: string[];
    treeStroke: string | null;
    iconOutline: string;
    iconLight: string;
    /** Accent pairs [main, accent] cycled across landmarks. */
    iconPalette: [string, string][];
    badgeFill: string;
    badgeStroke: string;
    home: string;
    titleBg: string;
    titleText: string;
    titleAccent: string;
    border: string;
  };
  roads: { width: Record<RoadClass, number>; casing: number; centerLineClasses: RoadClass[] };
  strokes: { area: number; building: number; icon: number };
  effects: {
    trees: boolean;
    waves: boolean;
    pitchLines: boolean;
    wash: boolean;
    grain: boolean;
    buildingRadius: boolean;
    /** Draw small buildings as little storybook houses (at their true positions). */
    houses: boolean;
    /** Decorative toy cars on the bigger roads. */
    cars: boolean;
    /** Decorative flowers sprinkled on open ground. */
    flowers: boolean;
    /** Generalise the street network: main streets and longer side streets only. */
    fewerRoads: boolean;
  };
  /** 'building' draws landmarks as large illustrated buildings with signboards. */
  badge: 'sticker' | 'disc' | 'ring' | 'building';
  iconMode: 'color' | 'mono';
  title: 'ribbon' | 'band' | 'plate';
  border: 'rounded' | 'double' | 'line' | 'none';
}

const W = (motorway: number, primary: number, tertiary: number, minor: number, service: number, path: number, rail: number): Record<RoadClass, number> => ({
  motorway,
  trunk: motorway * 0.92,
  primary,
  secondary: (primary + tertiary) / 2,
  tertiary,
  minor,
  service,
  path,
  rail,
});

export const STYLES: Record<StyleId, MapStyle> = {
  playful: {
    id: 'playful',
    name: 'Playtime',
    tagline: 'A play-rug town of your own streets',
    fonts: { display: 'fredoka-600', label: 'nunito-800', displayTracking: 0, labelTracking: 0.01, displayUpper: false, labelUpper: false, labelSize: 12.5 },
    colors: {
      paper: '#FFF8EA',
      land: '#A6DE6B',
      ink: '#2F3447',
      areas: { park: '#6CC24A', grass: '#8FD45C', wood: '#4FAE4B', sand: '#FFE08A', pitch: '#58B94E', playground: '#FFC98B', school: '#FFE79A', hospital: '#FCD5D5', cemetery: '#C5DDB0', commercial: '#FFD9A8', industrial: '#D9D2F0', residential: '#B4E67C', farmland: '#E9E7A8', wetland: '#A9DCC0' },
      areaStroke: '#2F3447',
      water: '#4FC3F7',
      waterStroke: '#2F3447',
      waterDetail: '#FFFFFF',
      buildings: ['#FF8A65', '#FFD166', '#6EC6FF', '#C792EA', '#FF7EB6', '#8BD3A8'],
      buildingStroke: '#2F3447',
      buildingShadow: null,
      roadMajor: '#BDC1C9',
      roadMinor: '#C6C9D0',
      roadCasing: '#8A90A0',
      centerLine: '#FFFFFF',
      rail: '#2F3447',
      path: '#B08D57',
      roadLabel: '#FFFFFF',
      roadLabelHalo: '#6E7486',
      label: '#2F3447',
      labelHalo: '#FFFDF5',
      tree: ['#2E9E4F', '#43B047', '#1F8A4C'],
      treeStroke: '#2F3447',
      iconOutline: '#2F3447',
      iconLight: '#FFFFFF',
      iconPalette: [['#FF6B6B', '#FFD166'], ['#4DABF7', '#FFD166'], ['#51CF66', '#FF8A65'], ['#B197FC', '#FFD166'], ['#FF922B', '#4DABF7'], ['#F783AC', '#63E6BE']],
      badgeFill: '#FFFFFF',
      badgeStroke: '#2F3447',
      home: '#FF5A5F',
      titleBg: '#FFFFFF',
      titleText: '#2F3447',
      titleAccent: '#FF5A5F',
      border: '#2F3447',
    },
    roads: { width: W(32, 28, 24, 19, 8, 3, 3.2), casing: 1.8, centerLineClasses: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'] },
    strokes: { area: 2, building: 1.6, icon: 2.6 },
    effects: { trees: true, waves: true, pitchLines: true, wash: false, grain: false, buildingRadius: true, houses: true, cars: true, flowers: true, fewerRoads: true },
    badge: 'building',
    iconMode: 'color',
    title: 'ribbon',
    border: 'rounded',
  },
  minimal: {
    id: 'minimal',
    name: 'Studio',
    tagline: 'Quiet lines for a calm wall',
    fonts: { display: 'josefin-600', label: 'inter-500', displayTracking: 0.14, labelTracking: 0.06, displayUpper: true, labelUpper: true, labelSize: 9 },
    colors: {
      paper: '#FAF9F6',
      land: '#FAF9F6',
      ink: '#23262D',
      areas: { park: '#E3EADB', grass: '#EBEFE3', wood: '#DCE5D2', sand: '#F3EEDF', pitch: '#DDE7D2', playground: '#EFEADB', school: '#F1EEE6', cemetery: '#E6EADF', wetland: '#DDE7E2', farmland: '#F1EFE0' },
      areaStroke: null,
      water: '#D4E0E6',
      waterStroke: null,
      waterDetail: '#BFD0D8',
      buildings: ['#E9E6DF'],
      buildingStroke: null,
      buildingShadow: null,
      roadMajor: '#23262D',
      roadMinor: '#3B3F48',
      roadCasing: null,
      centerLine: null,
      rail: '#8B8F98',
      path: '#A9ADB5',
      roadLabel: '#23262D',
      roadLabelHalo: '#FAF9F6',
      label: '#23262D',
      labelHalo: '#FAF9F6',
      tree: ['#C9D6BD'],
      treeStroke: null,
      iconOutline: '#23262D',
      iconLight: '#FAF9F6',
      iconPalette: [['#23262D', '#23262D']],
      badgeFill: '#23262D',
      badgeStroke: '#FAF9F6',
      home: '#C8553D',
      titleBg: '#FAF9F6',
      titleText: '#23262D',
      titleAccent: '#C8553D',
      border: '#23262D',
    },
    roads: { width: W(9, 7, 5, 3, 1.4, 0.9, 1.1), casing: 0, centerLineClasses: [] },
    strokes: { area: 0, building: 0, icon: 2.4 },
    effects: { trees: false, waves: false, pitchLines: false, wash: false, grain: false, buildingRadius: false, houses: false, cars: false, flowers: false, fewerRoads: false },
    badge: 'disc',
    iconMode: 'mono',
    title: 'band',
    border: 'line',
  },
  watercolor: {
    id: 'watercolor',
    name: 'Watercolor',
    tagline: 'Soft washes, like a page from a sketchbook',
    fonts: { display: 'caveat-700', label: 'kalam-400', displayTracking: 0, labelTracking: 0, displayUpper: false, labelUpper: false, labelSize: 12.5 },
    colors: {
      paper: '#FBF6EA',
      land: '#F6EDD6',
      ink: '#5A4636',
      areas: { park: '#B9D7A0', grass: '#CFE2B4', wood: '#A3C790', sand: '#F0DDA8', pitch: '#B4D49A', playground: '#F2CFA0', school: '#F1DDB4', hospital: '#F0CFC8', cemetery: '#C9D8B8', commercial: '#F1D6C4', industrial: '#DDD6E3', wetland: '#B5D8CC', farmland: '#E6DFA6' },
      areaStroke: null,
      water: '#9FD0E0',
      waterStroke: null,
      waterDetail: '#F4FBFC',
      buildings: ['#E8B49C', '#EDD09C', '#C7B3D6', '#B3CCE0', '#E3A9B4'],
      buildingStroke: '#8A735D',
      buildingShadow: null,
      roadMajor: '#FFFDF6',
      roadMinor: '#FFFDF6',
      roadCasing: '#C4AE8C',
      centerLine: null,
      rail: '#9C8872',
      path: '#C4A77A',
      roadLabel: '#6B5644',
      roadLabelHalo: '#FFFDF6',
      label: '#4E3D30',
      labelHalo: '#FBF6EA',
      tree: ['#7FB069', '#93C17A', '#6AA06A'],
      treeStroke: null,
      iconOutline: '#5A4636',
      iconLight: '#FFFDF6',
      iconPalette: [['#E07A5F', '#F2CC8F'], ['#6FA8C7', '#F2CC8F'], ['#81B29A', '#E9A58B'], ['#B79AC8', '#F2CC8F'], ['#E6A04E', '#8FBBD0']],
      badgeFill: '#FFFDF6',
      badgeStroke: '#8A735D',
      home: '#D9634C',
      titleBg: '#FFFDF6',
      titleText: '#4E3D30',
      titleAccent: '#D9634C',
      border: '#8A735D',
    },
    roads: { width: W(17, 14.5, 12, 9.5, 4.5, 2, 2.2), casing: 1.3, centerLineClasses: [] },
    strokes: { area: 0, building: 0.9, icon: 2.2 },
    effects: { trees: true, waves: true, pitchLines: false, wash: true, grain: true, buildingRadius: false, houses: false, cars: false, flowers: false, fewerRoads: false },
    badge: 'sticker',
    iconMode: 'color',
    title: 'plate',
    border: 'line',
  },
  vintage: {
    id: 'vintage',
    name: 'Heirloom',
    tagline: 'An old-world chart of your own streets',
    fonts: { display: 'playfair-700', label: 'fell-400', displayTracking: 0.02, labelTracking: 0.03, displayUpper: false, labelUpper: false, labelSize: 12 },
    colors: {
      paper: '#F2E6C9',
      land: '#ECDFBB',
      ink: '#4A3520',
      areas: { park: '#C4C68F', grass: '#D3D3A0', wood: '#B3BB82', sand: '#E6D19A', pitch: '#C0C48C', playground: '#DDC690', school: '#E3D2A2', cemetery: '#C9CBA0', commercial: '#E4CDA6', industrial: '#D9CDB4', wetland: '#B7C6A8', farmland: '#DDD49A' },
      areaStroke: '#7A5C3A',
      water: '#A6C3B8',
      waterStroke: '#5C7F78',
      waterDetail: '#5C7F78',
      buildings: ['#D8B585', '#CFA877', '#DDBF94'],
      buildingStroke: '#6B4F2E',
      buildingShadow: null,
      roadMajor: '#FBF3DA',
      roadMinor: '#FBF3DA',
      roadCasing: '#6B4F2E',
      centerLine: null,
      rail: '#4A3520',
      path: '#8A6A44',
      roadLabel: '#4A3520',
      roadLabelHalo: '#FBF3DA',
      label: '#3E2C1A',
      labelHalo: '#F2E6C9',
      tree: ['#8B9A5B', '#7C8C52'],
      treeStroke: '#4A3520',
      iconOutline: '#4A3520',
      iconLight: '#F7EDD3',
      iconPalette: [['#9C3D2A', '#C99A4B'], ['#3F6B6B', '#C99A4B'], ['#6E7B3C', '#C99A4B']],
      badgeFill: '#F7EDD3',
      badgeStroke: '#4A3520',
      home: '#9C3D2A',
      titleBg: '#F7EDD3',
      titleText: '#3E2C1A',
      titleAccent: '#9C3D2A',
      border: '#4A3520',
    },
    roads: { width: W(15, 13, 11, 8.5, 4, 1.8, 2.2), casing: 1.5, centerLineClasses: [] },
    strokes: { area: 0.9, building: 1, icon: 2.4 },
    effects: { trees: true, waves: true, pitchLines: false, wash: false, grain: true, buildingRadius: false, houses: false, cars: false, flowers: false, fewerRoads: false },
    badge: 'ring',
    iconMode: 'color',
    title: 'plate',
    border: 'double',
  },
  poster: {
    id: 'poster',
    name: 'Night Lights',
    tagline: 'Bold colour that owns the room',
    fonts: { display: 'bebas-400', label: 'barlow-600', displayTracking: 0.06, labelTracking: 0.05, displayUpper: true, labelUpper: true, labelSize: 11 },
    colors: {
      paper: '#101B33',
      land: '#16233F',
      ink: '#FFFFFF',
      areas: { park: '#1E6B5A', grass: '#1C5A50', wood: '#17594A', sand: '#3A3A52', pitch: '#237A63', playground: '#2B5C6B', school: '#22335A', cemetery: '#1B4F48', commercial: '#1D2C4F', industrial: '#1A2847', wetland: '#195A60' },
      areaStroke: null,
      water: '#0A1226',
      waterStroke: null,
      waterDetail: '#22365F',
      buildings: ['#243863', '#2A416F'],
      buildingStroke: null,
      buildingShadow: null,
      roadMajor: '#FFB627',
      roadMinor: '#EDEFF5',
      roadCasing: null,
      centerLine: null,
      rail: '#7C8AAE',
      path: '#5C6C94',
      roadLabel: '#FFFFFF',
      roadLabelHalo: '#16233F',
      label: '#FFFFFF',
      labelHalo: '#101B33',
      tree: ['#2A8A70'],
      treeStroke: null,
      iconOutline: '#101B33',
      iconLight: '#FFFFFF',
      iconPalette: [['#FFB627', '#FF6B6B'], ['#4CC9F0', '#FFB627'], ['#FF6B6B', '#FFB627'], ['#80ED99', '#FFB627']],
      badgeFill: '#FFFFFF',
      badgeStroke: '#101B33',
      home: '#FF4D6D',
      titleBg: '#101B33',
      titleText: '#FFFFFF',
      titleAccent: '#FFB627',
      border: '#FFB627',
    },
    roads: { width: W(12, 9.5, 7, 4, 1.8, 1, 1.4), casing: 0, centerLineClasses: [] },
    strokes: { area: 0, building: 0, icon: 2.6 },
    effects: { trees: false, waves: false, pitchLines: true, wash: false, grain: false, buildingRadius: false, houses: false, cars: false, flowers: false, fewerRoads: false },
    badge: 'sticker',
    iconMode: 'color',
    title: 'band',
    border: 'line',
  },
  blueprint: {
    id: 'blueprint',
    name: 'Atelier',
    tagline: 'Fine architectural linework',
    fonts: { display: 'cormorant-600', label: 'josefin-400', displayTracking: 0.08, labelTracking: 0.1, displayUpper: true, labelUpper: true, labelSize: 8.5 },
    colors: {
      paper: '#F6F4EE',
      land: '#F6F4EE',
      ink: '#27364F',
      areas: { park: '#E1E9D6', grass: '#E8EEDF', wood: '#D7E2CB', sand: '#EFE9D8', pitch: '#DCE6D0', playground: '#EEE7D6', school: '#ECE9E0', cemetery: '#E2E8DA', wetland: '#D9E6E2' },
      areaStroke: '#8FA08A',
      water: '#D3E1EE',
      waterStroke: '#6F8FB3',
      waterDetail: '#6F8FB3',
      buildings: ['#DCE2EC', '#E4E8F0'],
      buildingStroke: '#27364F',
      buildingShadow: '#B9C2D0',
      roadMajor: '#FFFFFF',
      roadMinor: '#FFFFFF',
      roadCasing: '#27364F',
      centerLine: null,
      rail: '#27364F',
      path: '#7B88A0',
      roadLabel: '#27364F',
      roadLabelHalo: '#FFFFFF',
      label: '#27364F',
      labelHalo: '#F6F4EE',
      tree: ['#C3D3B5'],
      treeStroke: '#8FA08A',
      iconOutline: '#27364F',
      iconLight: '#F6F4EE',
      iconPalette: [['#27364F', '#B08D57']],
      badgeFill: '#F6F4EE',
      badgeStroke: '#27364F',
      home: '#B4543A',
      titleBg: '#F6F4EE',
      titleText: '#27364F',
      titleAccent: '#B08D57',
      border: '#27364F',
    },
    roads: { width: W(13, 11, 9, 7, 3.2, 1.2, 1.6), casing: 0.8, centerLineClasses: [] },
    strokes: { area: 0.6, building: 0.6, icon: 2 },
    effects: { trees: true, waves: false, pitchLines: true, wash: false, grain: false, buildingRadius: false, houses: false, cars: false, flowers: false, fewerRoads: false },
    badge: 'ring',
    iconMode: 'mono',
    title: 'band',
    border: 'double',
  },
};

export const STYLE_LIST: MapStyle[] = Object.values(STYLES);

export function getStyle(id: string): MapStyle {
  return STYLES[id as StyleId] ?? STYLES.playful;
}
