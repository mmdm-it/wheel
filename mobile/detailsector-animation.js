/**
 * Detail Sector Animation Module
 * Handles circle/logo creation, positioning, and expand/collapse animations
 * 
 * Responsibilities:
 * - Create and position the Detail Sector circle in upper right corner
 * - Create and position the volume logo over the circle
 * - Animate expansion from upper right to focus ring center
 * - Animate collapse from focus ring center back to upper right
 * - Calculate logo end state positioning
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

export class DetailSectorAnimation {
    constructor(viewportManager, dataManager, renderer) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.renderer = renderer;
        this.isAnimating = false;
    }

    /**
     * Create the Detail Sector circle at upper right corner
     * This circle animates to the focus ring center when a leaf item is selected
     */
    createCircle() {
        // Check if circle should be hidden for this volume
        const displayConfig = this.dataManager.getDisplayConfig();
        const hideCircle = displayConfig?.detail_sector?.hide_circle;
        
        if (hideCircle) {
            Logger.debug('🔵 Detail Sector circle disabled by config (hide_circle: true)');
            // Remove any existing circle from previous volume
            const existingCircle = document.getElementById('detailSectorCircle');
            if (existingCircle) {
                existingCircle.remove();
                Logger.debug('🔵 Removed existing Detail Sector circle');
            }
            return;
        }
        
        // Calculate radius as 12% of the shorter viewport dimension
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Calculate logo dimensions (needed for proper positioning)
        const logoScaleFactor = 1.8;
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation since logo is wider than circle
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Create Detail Sector circle
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('id', 'detailSectorCircle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', '#362e6a'); // MMdM blue
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('opacity', '0.5'); // START state: 50% opacity
        
        // Insert at the BEGINNING of mainGroup so all other elements appear on top
        const mainGroup = this.renderer.elements.mainGroup;
        if (mainGroup && mainGroup.firstChild) {
            mainGroup.insertBefore(circle, mainGroup.firstChild);
            Logger.debug(`🔵 Detail Sector circle inserted at BEGINNING of mainGroup (below all other elements)`);
        } else if (mainGroup) {
            mainGroup.appendChild(circle);
            Logger.debug(`🔵 Detail Sector circle appended to empty mainGroup`);
        } else {
            Logger.error(`🔵 mainGroup not found - cannot insert Detail Sector circle`);
            return;
        }
        
        // Calculate top buffer for debug logging
        const circleTopEdge = cy - radius;
        const topBuffer = circleTopEdge - (-(viewportHeight / 2));
        
        Logger.debug(`🔵 Detail Sector circle created at (${cx.toFixed(1)}, ${cy.toFixed(1)}) with ${radius.toFixed(1)}px radius`);
        Logger.debug(`   Circle top edge: ${circleTopEdge.toFixed(1)}, Screen top: ${(-(viewportHeight/2)).toFixed(1)}`);
        Logger.debug(`   Circle top buffer from screen edge: ${topBuffer.toFixed(1)}px (margin: ${margin.toFixed(1)}px)`);
        
        // Create Detail Sector logo
        this.createLogo();
    }
    
    /**
     * Create the volume logo positioned over the Detail Sector circle
     * Logo is centered at the same position as the circle
     */
    createLogo() {
        // Calculate the same position as Detail Sector circle
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Scale logo relative to circle radius
        // Logo aspect ratio: 154:134 = ~1.149:1
        const logoAspectRatio = 154 / 134;
        const logoScaleFactor = 1.8; // Logo width = 180% of circle diameter (3.6× radius)
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHeight = logoWidth / logoAspectRatio;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Calculate top-left position to center logo over circle center
        const x = cx - (logoWidth / 2);
        const y = cy - (logoHeight / 2);
        
        // Get configured logo path from catalog configuration
        const displayConfig = this.dataManager.getDisplayConfig();
        const detailSectorConfig = displayConfig && displayConfig.detail_sector;
        const logoBasePath = detailSectorConfig && detailSectorConfig.logo_base_path;
        const defaultImage = detailSectorConfig && detailSectorConfig.default_image;
        
        // Check if logo is configured
        if (logoBasePath && defaultImage) {
            // Logo is configured - create image element
            const logoPath = logoBasePath + defaultImage + '.png';
            
            const logo = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'image');
            logo.setAttribute('id', 'detailSectorLogo');
            logo.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoPath);
            logo.setAttribute('x', x);
            logo.setAttribute('y', y);
            logo.setAttribute('width', logoWidth);
            logo.setAttribute('height', logoHeight);
            logo.setAttribute('opacity', '0.5'); // START state: 50% opacity
            logo.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier
            
            // Add to main group
            this.renderer.elements.mainGroup.appendChild(logo);
            
            Logger.debug(`🔵 Detail Sector logo created at (${x.toFixed(1)}, ${y.toFixed(1)}) with size ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (${logoScaleFactor * 100}% of circle diameter)`);
            Logger.debug(`🔵 Logo path: ${logoPath}`);
        } else {
            // No logo configured - create text element with "Choose an Image"
            const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
            textElement.setAttribute('id', 'detailSectorLogo');
            textElement.setAttribute('x', cx);
            textElement.setAttribute('y', cy);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('class', 'logo-placeholder');
            textElement.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier
            textElement.setAttribute('opacity', '0.5'); // START state: 50% opacity
            textElement.textContent = 'Choose an Image';
            
            // Add to main group
            this.renderer.elements.mainGroup.appendChild(textElement);
            
            Logger.debug(`🔵 Detail Sector text created at (${cx.toFixed(1)}, ${cy.toFixed(1)}) - no logo configured`);
        }
    }
    
    /**
     * Update the Detail Sector logo after volume loading
     * Replaces the "Choose an Image" text with the actual catalog logo
     */
    updateLogo() {
        const existingLogo = document.getElementById('detailSectorLogo');
        if (existingLogo) {
            // Remove existing logo from previous volume
            existingLogo.remove();
            Logger.debug('🔵 Removed existing Detail Sector logo');
        }
        
        // Create new logo based on current volume configuration
        this.createLogo();
        
        Logger.debug('🔵 Detail Sector logo updated for loaded volume');
    }

    /**
     * Calculate END state position and size for Detail Sector logo
     * Returns logo dimensions and position for expanded state
     * Uses same calculation as test logo for consistency
     */
    getLogoEndState() {
        // Get Focus Ring parameters (same as test logo)
        const arcParams = this.viewport.getArcParameters();
        const focusRingRadius = arcParams.radius;
        
        // Get magnifier angle (same as test logo)
        const magnifierAngle = this.viewport.getCenterAngle();
        
        // Logo dimensions: 100% of Focus Ring radius for width (same as test logo)
        const logoAspectRatio = 154 / 134; // Original aspect ratio
        const logoWidth = focusRingRadius * 1.0;
        const logoHeight = logoWidth / logoAspectRatio;
        
        // Position center of logo along magnifier angle at -35% of Focus Ring radius (same as test logo)
        const logoCenterRadius = focusRingRadius * -0.35;
        const logoCenterX = logoCenterRadius * Math.cos(magnifierAngle);
        const logoCenterY = logoCenterRadius * Math.sin(magnifierAngle);
        
        // Position logo so its center is at the calculated point
        const endX = logoCenterX - (logoWidth / 2);
        const endY = logoCenterY - (logoHeight / 2);
        
        // Debug calculation
        Logger.debug(`🔵 getLogoEndState() calculation (matching test logo):`);
        Logger.debug(`   Focus Ring radius: ${focusRingRadius.toFixed(1)}`);
        Logger.debug(`   Logo center at (${logoCenterX.toFixed(1)}, ${logoCenterY.toFixed(1)}) (-35% of radius)`);
        Logger.debug(`   Logo size: ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (100% of radius)`);
        Logger.debug(`   Logo position: (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
        
        return {
            x: endX,
            y: endY,
            width: logoWidth,
            height: logoHeight,
            centerX: logoCenterX,
            centerY: logoCenterY
        };
    }

    /**
     * Expand the Detail Sector circle and logo
     * Animates from upper right corner to focus ring center
     */
    expand(onComplete) {
        Logger.debug('🔵 expandDetailSector() called - animating circle and logo');
        this.isAnimating = true;
        const arcParams = this.viewport.getArcParameters();
        
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        // Check if circle should be hidden for this volume
        const displayConfig = this.dataManager.getDisplayConfig();
        const hideCircle = displayConfig?.detail_sector?.hide_circle;
        
        if (!detailLogo || (!detailCircle && !hideCircle)) {
            Logger.error('🔵 Detail Sector elements not found for expansion');
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }
        
        // Get color and opacity from display config (only if circle exists)
        const detailColor = displayConfig?.color_scheme?.detail_sector;
        const detailOpacity = displayConfig?.color_scheme?.detail_sector_opacity || '1.0';
        
        // Only change color if explicitly set in config and circle exists
        if (detailCircle && detailColor) {
            detailCircle.setAttribute('fill', detailColor);
        }
        
        // Calculate circle START position (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const startRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for proper positioning
        const logoScaleFactor = 1.8;
        const startLogoWidth = startRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const startLogoHeight = startLogoWidth / logoAspectRatio;
        const logoHalfWidth = startLogoWidth / 2;
        
        // Circle START position
        const circleStartX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleStartY = -(viewportHeight / 2) + startRadius + margin;
        
        // Logo START position (top-left corner for image element)
        const logoStartX = circleStartX - (startLogoWidth / 2);
        const logoStartY = circleStartY - (startLogoHeight / 2);
        
        // Calculate circle END position (focus ring center)
        const circleEndX = arcParams.centerX;
        const circleEndY = arcParams.centerY;
        const endRadius = arcParams.radius * 0.99;  // Match Focus Ring inner edge
        
        // Calculate logo END position (centered horizontally, same top buffer)
        const logoEndState = this.getLogoEndState();
        
        // Opacity animation values
        const startOpacity = 0.5;
        const circleEndOpacity = parseFloat(detailOpacity); // Use config value for end opacity
        const logoEndOpacity = 0.10;
        
        // Rotation animation values
        const startRotation = 0; // Initial logo has no rotation
        const magnifierAngle = this.viewport.getCenterAngle();
        const endRotation = (magnifierAngle * 180 / Math.PI) - 180; // Match test logo rotation (CCW)
        
        // Animate to END state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentCircleOpacity = startOpacity + (circleEndOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartX + (logoEndState.x - logoStartX) * eased;
            const currentLogoY = logoStartY + (logoEndState.y - logoStartY) * eased;
            const currentLogoWidth = startLogoWidth + (logoEndState.width - startLogoWidth) * eased;
            const currentLogoHeight = startLogoHeight + (logoEndState.height - startLogoHeight) * eased;
            const currentLogoOpacity = startOpacity + (logoEndOpacity - startOpacity) * eased;
            const currentRotation = startRotation + (endRotation - startRotation) * eased;
            
            // Apply animated values to circle (if it exists)
            if (detailCircle) {
                detailCircle.setAttribute('cx', currentCircleX);
                detailCircle.setAttribute('cy', currentCircleY);
                detailCircle.setAttribute('r', currentRadius);
                detailCircle.setAttribute('opacity', currentCircleOpacity);
            }
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentLogoOpacity);
            
            // Apply rotation transform with current center as rotation point
            const currentCenterX = currentLogoX + currentLogoWidth / 2;
            const currentCenterY = currentLogoY + currentLogoHeight / 2;
            detailLogo.setAttribute('transform', `rotate(${currentRotation}, ${currentCenterX}, ${currentCenterY})`);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact END state for circle (if it exists)
                if (detailCircle) {
                    detailCircle.setAttribute('cx', circleEndX);
                    detailCircle.setAttribute('cy', circleEndY);
                    detailCircle.setAttribute('r', endRadius);
                    detailCircle.setAttribute('opacity', detailOpacity); // END state: configurable opacity
                }
                
                // Ensure exact END state for logo
                detailLogo.setAttribute('x', logoEndState.x);
                detailLogo.setAttribute('y', logoEndState.y);
                detailLogo.setAttribute('width', logoEndState.width);
                detailLogo.setAttribute('height', logoEndState.height);
                detailLogo.setAttribute('opacity', '0.10'); // END state: 10% opacity
                
                // Apply rotation to match test logo
                const magnifierAngle = this.viewport.getCenterAngle();
                const rotationDegrees = (magnifierAngle * 180 / Math.PI) - 180;
                detailLogo.setAttribute('transform', `rotate(${rotationDegrees}, ${logoEndState.centerX}, ${logoEndState.centerY})`);
                
                // Calculate top buffer for debug logging
                const logoTopEdge = logoEndState.y;
                const screenTop = -(window.innerHeight / 2);
                const topBuffer = logoTopEdge - screenTop;
                
                Logger.debug(`🔵 Detail Sector animation COMPLETE - END STATE reached`);
                Logger.debug(`   Circle: (${circleEndX}, ${circleEndY}) r=${endRadius}px`);
                Logger.debug(`   Logo: (${logoEndState.x}, ${logoEndState.y}) ${logoEndState.width}x${logoEndState.height}px`);
                Logger.debug(`   Logo top edge: ${logoTopEdge.toFixed(1)}, Screen top: ${screenTop.toFixed(1)}`);
                Logger.debug(`   Logo top buffer from screen edge: ${topBuffer.toFixed(1)}px`);
                
                this.isAnimating = false;
                if (onComplete) onComplete();
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector animation STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${startLogoWidth.toFixed(1)}x${startLogoHeight.toFixed(1)} TO: ${logoEndState.width}x${logoEndState.height}`);
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item
     * Animates from focus ring center back to upper right corner
     */
    collapse(onComplete) {
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        if (!detailCircle || !detailLogo) {
            if (onComplete) onComplete();
            return;
        }

        this.isAnimating = true;
        
        // Check if circle is already collapsed
        const currentRadius = parseFloat(detailCircle.getAttribute('r'));
        const vWidth = window.innerWidth;
        const vHeight = window.innerHeight;
        const shorter = Math.min(vWidth, vHeight);
        const collapsedRadius = shorter * 0.12;
        
        if (Math.abs(currentRadius - collapsedRadius) < 10) {
            Logger.debug('🔵 Detail Sector already collapsed - skipping animation');
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }
        
        // Get circle START state (expanded at focus ring center)
        const arcParams = this.viewport.getArcParameters();
        const circleStartX = arcParams.centerX;
        const circleStartY = arcParams.centerY;
        const startRadius = arcParams.radius * 0.98;
        
        // Get logo START state (centered horizontally, at top)
        const logoStartState = this.getLogoEndState();
        
        // Calculate circle END state (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const endRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for END state
        const logoScaleFactor = 1.8;
        const endLogoWidth = endRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const endLogoHeight = endLogoWidth / logoAspectRatio;
        const logoHalfWidth = endLogoWidth / 2;
        
        // Circle END position
        const circleEndX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleEndY = -(viewportHeight / 2) + endRadius + margin;
        
        // Logo END position (top-left corner for image element)
        const logoEndX = circleEndX - (endLogoWidth / 2);
        const logoEndY = circleEndY - (endLogoHeight / 2);
        
        // Opacity animation values
        const startOpacity = 1.0;
        const endOpacity = 0.5;
        
        // Rotation animation values - get current rotation from transform attribute
        const currentTransform = detailLogo.getAttribute('transform') || '';
        const rotateMatch = currentTransform.match(/rotate\(([^,]+)/);
        const startRotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
        const endRotation = 0; // Back to START state (no rotation)
        
        // Animate back to collapsed state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentOpacity = startOpacity + (endOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartState.x + (logoEndX - logoStartState.x) * eased;
            const currentLogoY = logoStartState.y + (logoEndY - logoStartState.y) * eased;
            const currentLogoWidth = logoStartState.width + (endLogoWidth - logoStartState.width) * eased;
            const currentLogoHeight = logoStartState.height + (endLogoHeight - logoStartState.height) * eased;
            const currentRotation = startRotation + (endRotation - startRotation) * eased;
            
            // Apply animated values to circle (if it exists)
            if (detailCircle) {
                detailCircle.setAttribute('cx', currentCircleX);
                detailCircle.setAttribute('cy', currentCircleY);
                detailCircle.setAttribute('r', currentRadius);
                detailCircle.setAttribute('opacity', currentOpacity);
            }
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentOpacity);
            
            // Apply rotation transform with current center as rotation point
            const currentCenterX = currentLogoX + currentLogoWidth / 2;
            const currentCenterY = currentLogoY + currentLogoHeight / 2;
            detailLogo.setAttribute('transform', `rotate(${currentRotation}, ${currentCenterX}, ${currentCenterY})`);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact collapsed state for circle (if it exists)
                if (detailCircle) {
                    detailCircle.setAttribute('cx', circleEndX);
                    detailCircle.setAttribute('cy', circleEndY);
                    detailCircle.setAttribute('r', endRadius);
                    detailCircle.setAttribute('opacity', '0.5'); // START state: 50% opacity
                }
                
                // Ensure exact collapsed state for logo
                detailLogo.setAttribute('x', logoEndX);
                detailLogo.setAttribute('y', logoEndY);
                detailLogo.setAttribute('width', endLogoWidth);
                detailLogo.setAttribute('height', endLogoHeight);
                detailLogo.setAttribute('opacity', '0.5'); // START state: 50% opacity
                detailLogo.setAttribute('transform', 'rotate(0)'); // START state: no rotation
                
                Logger.debug(`🔵 Detail Sector collapse COMPLETE`);
                Logger.debug(`   Circle: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
                Logger.debug(`   Logo: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);

                this.isAnimating = false;
                if (onComplete) onComplete();
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector collapse STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${logoStartState.width}x${logoStartState.height} TO: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);
    }
}
