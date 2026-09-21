import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES, TRANSPORT_MODES } from '../utils/constants';

interface RouteStepCardProps {
    step: {
        id: number;
        mode: string;
        instruction: string;
        duration_mins: number;
        distance_km?: number;
        fare?: number;
        from_stop?: string;
        to_stop?: string;
    };
    isLast?: boolean;
}

export const RouteStepCard = ({ step, isLast }: RouteStepCardProps) => {
    const { WW } = useAppTheme();
    const getIcon = (mode: string, instruction: string) => {
        const lowerMode = mode.toLowerCase();
        const lowerInstr = instruction.toLowerCase();

        if (lowerMode === TRANSPORT_MODES.BUS || lowerInstr.includes('brt')) return 'bus';
        if (lowerInstr.includes('danfo')) return 'van-passenger';
        if (lowerMode === TRANSPORT_MODES.KEKE || lowerInstr.includes('keke')) return 'rickshaw-electric'; // Closest to Keke
        if (lowerMode === TRANSPORT_MODES.OKADA || lowerInstr.includes('okada')) return 'motorbike';
        if (lowerMode === TRANSPORT_MODES.WALK) return 'walk';

        return 'map-marker';
    };

    const getColor = (mode: string) => {
        switch (mode) {
            case TRANSPORT_MODES.BUS: return WW.orange;
            case TRANSPORT_MODES.WALK: return WW.brt;
            case TRANSPORT_MODES.OKADA: return WW.orange;
            default: return WW.orangeGlow;
        }
    };

    return (
        <View style={styles.container}>
            {/* Timeline Section */}
            <View style={styles.timelineContainer}>
                <View style={[styles.iconContainer, { backgroundColor: getColor(step.mode) }]}>
                    <MaterialCommunityIcons name={getIcon(step.mode, step.instruction) as any} size={16} color="#FFFFFF" />
                </View>
                {!isLast && <View style={styles.line} />}
            </View>

            {/* Content Section */}
            <View style={styles.contentContainer}>
                <Text style={[styles.instruction, { color: WW.text }]}>{step.instruction}</Text>

                <View style={styles.metaContainer}>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={WW.textSub} />
                        <Text style={[styles.metaText, { color: WW.textSub }]}>{step.duration_mins} min</Text>
                    </View>

                    {!!step.distance_km && (
                        <View style={styles.metaItem}>
                            <Ionicons name="resize-outline" size={14} color={WW.textSub} />
                            <Text style={[styles.metaText, { color: WW.textSub }]}>{step.distance_km} km</Text>
                        </View>
                    )}

                    {(step.fare ?? 0) > 0 && (
                        <View style={styles.metaItem}>
                            <Ionicons name="wallet-outline" size={14} color={WW.textSub} />
                            <Text style={[styles.metaText, { color: WW.textSub }]}>₦{step.fare}</Text>
                        </View>
                    )}
                </View>

                {/* Stop Details (if applicable) */}
                {(step.from_stop || step.to_stop) && (
                    <View style={styles.stopDetails}>
                        {!!step.from_stop && <Text style={styles.stopText}>From: {step.from_stop}</Text>}
                        {!!step.to_stop && <Text style={styles.stopText}>To: {step.to_stop}</Text>}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        minHeight: 80,
    },
    timelineContainer: {
        alignItems: 'center',
        width: 40,
        marginRight: SPACING.SM,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    line: {
        width: 2,
        flex: 1,
        marginVertical: 4,
    },
    contentContainer: {
        flex: 1,
        paddingBottom: SPACING.LG,
        borderBottomWidth: 1,
        marginBottom: SPACING.SM,
    },
    instruction: {
        fontSize: FONT_SIZES.BODY_LARGE,
        fontWeight: '700',
        marginBottom: SPACING.XS,
    },
    metaContainer: {
        flexDirection: 'row',
        gap: SPACING.MD,
        marginBottom: SPACING.XS,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: FONT_SIZES.CAPTION,
        fontWeight: '500',
    },
    stopDetails: {
        padding: SPACING.SM,
        borderRadius: BORDER_RADIUS.SMALL,
        marginTop: SPACING.XS,
    },
    stopText: {
        fontSize: FONT_SIZES.SMALL,
    },
});
