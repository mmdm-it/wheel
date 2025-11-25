/**
 * Mobile Catalog Animation Module
 * Handles all node migration animations for the mobile catalog system
 * 
 * This module manages:
 * - IN animations (Child Pyramid → Focus Ring)
 * - OUT animations (Focus Ring → Child Pyramid) 
 * - Magnifier position transitions
 * - Stack-based animation node reuse for smooth reversals
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Animation manager for mobile catalog node migrations
 */
class MobileAnimation {
    constructor(viewportManager, dataManager, renderer) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.renderer = renderer;
        
        // Store animated nodes for OUT migration reuse - LIFO stack per hierarchy level
        this.animatedNodesStack = [];
        
        // Debug flag for IN/OUT loop playback
        this.loopInOutDebugFlag = false;
    }
    
    /**
     * Animate a single Child Pyramid node to the Magnifier position
     * @param {SVGElement} nodeGroup - The SVG group element containing the node
     * @param {Object} startPos - Starting position {x, y}
     * @param {Object} endPos - Ending position {x, y, angle}
     * @param {Function} onComplete - Callback when animation completes
     */
    animateNodeToMagnifier(nodeGroup, startPos, endPos, onComplete) {
        Logger.debug('🎬 Starting node animation to Magnifier', startPos, endPos);
        
        // Clone the node group for animation
        const animatedNode = nodeGroup.cloneNode(true);
        animatedNode.classList.add('animating-node');
        
        // Calculate starting rotation from original node
        const originalCircle = nodeGroup.querySelector('.node');
        const startX = parseFloat(originalCircle.getAttribute('cx'));
        const startY = parseFloat(originalCircle.getAttribute('cy'));
        
        // Calculate angle from center for starting rotation
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const dx = startX - magnifierPos.x;
        const dy = startY - magnifierPos.y;
        const startAngle = Math.atan2(dy, dx);
        let startRotation = startAngle * 180 / Math.PI;
        if (Math.cos(startAngle) < 0) {
            startRotation += 180;
        }
        
        // Calculate end rotation (same logic as focus ring items)
        let endRotation = endPos.angle * 180 / Math.PI;
        if (Math.cos(endPos.angle) < 0) {
            endRotation += 180;
        }
        
        // Append animated node to main group (above everything)
        const mainGroup = document.getElementById('mainGroup');
        mainGroup.appendChild(animatedNode);
        
        // Calculate translation needed
        const translateX = endPos.x - startX;
        const translateY = endPos.y - startY;
        const rotationDelta = endRotation - startRotation;
        
        Logger.debug(`🎬 Animation params: translate(${translateX.toFixed(1)}, ${translateY.toFixed(1)}) rotate ${rotationDelta.toFixed(1)}°`);
        
        // Apply starting state
        animatedNode.style.transformOrigin = `${startX}px ${startY}px`;
        animatedNode.style.transform = 'translate(0, 0) rotate(0deg)';
        animatedNode.style.transition = 'none';
        
        // Force reflow
        animatedNode.getBoundingClientRect();
        
        // Apply animation
        setTimeout(() => {
            animatedNode.style.transition = 'transform 600ms ease-in-out';
            animatedNode.style.transform = `translate(${translateX}px, ${translateY}px) rotate(${rotationDelta}deg)`;
            
            // Clean up when animation completes
            setTimeout(() => {
                animatedNode.remove();
                Logger.debug('🎬 Animation complete, node removed');
                if (onComplete) onComplete();
            }, 600);
        }, 10);
    }
    
    /**
     * Animate the current Magnifier node to Parent Button position
     * Used during IN migration to transition the parent item away
     * @param {Object} clickedItem - The item that was clicked (will become new magnifier)
     * @param {Object} currentMagnifiedItem - The current item at magnifier (parent of clicked)
     */
    /**
     * Stage 3: Animate Magnifier to Parent Button (IN)
     * Animates current Magnifier content to Parent Button position during IN migration
     * Also includes Stage 5: animating old Parent Button off-screen
     */
    animateMagnifierToParentButton(clickedItem, currentMagnifiedItem) {
        console.log('🎬🎬🎬 Stage 3 + Stage 5: Magnifier → Parent Button (IN migration)');
        console.log('🎬 Clicked item:', clickedItem?.name);
        console.log('🎬 Current magnified item:', currentMagnifiedItem?.name);
        
        if (!currentMagnifiedItem) {
            Logger.debug('🎬 No current magnified item to animate');
            return;
        }
        
        // Hide the actual Magnifier ring during animation
        const magnifierRing = document.getElementById('magnifier');
        if (magnifierRing) {
            magnifierRing.style.display = 'none';
        }
        
        // Get start position (Magnifier)
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const startX = magnifierPos.x;
        const startY = magnifierPos.y;
        const startAngle = magnifierPos.angle;
        
        // Get end position (Parent Button)
        const viewport = this.viewport.getViewportInfo();
        const LSd = Math.max(viewport.width, viewport.height);
        const arcParams = this.viewport.getArcParameters();
        const parentButtonAngle = 135 * Math.PI / 180;
        const parentButtonRadius = 0.9 * LSd * Math.SQRT2;
        const endX = arcParams.centerX + parentButtonRadius * Math.cos(parentButtonAngle);
        const endY = arcParams.centerY + parentButtonRadius * Math.sin(parentButtonAngle);
        
        // Calculate rotations for text
        let startRotation = startAngle * 180 / Math.PI;
        if (Math.cos(startAngle) < 0) startRotation += 180;
        
        let endRotation = 135;
        if (Math.cos(parentButtonAngle) < 0) endRotation += 180; // Results in 315°
        
        // Create animated group
        const mainGroup = document.getElementById('mainGroup');
        const animatedGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        animatedGroup.classList.add('animating-magnifier');
        
        // Create circle
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('cx', startX);
        circle.setAttribute('cy', startY);
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.MAGNIFIED);
        circle.setAttribute('fill', this.renderer.getColor(currentMagnifiedItem.__level, currentMagnifiedItem.name));
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        
        // Create text - centered over circle
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        text.setAttribute('x', startX);
        text.setAttribute('y', startY);
        text.setAttribute('dy', '0.3em');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('transform', `rotate(${startRotation}, ${startX}, ${startY})`);
        text.setAttribute('fill', 'black');
        text.style.fontSize = '20px';
        text.style.fontWeight = 'bold';
        text.textContent = currentMagnifiedItem.name;
        
        animatedGroup.appendChild(circle);
        animatedGroup.appendChild(text);
        mainGroup.appendChild(animatedGroup);
        
        // Force reflow
        animatedGroup.getBoundingClientRect();
        
        // Start animation
        setTimeout(() => {
            // Animate circle via CSS transition
            circle.style.transition = 'cx 600ms ease-in-out, cy 600ms ease-in-out';
            circle.setAttribute('cx', endX);
            circle.setAttribute('cy', endY);
            
            // Animate text position, size, weight, and rotation
            const startTime = performance.now();
            const duration = 600;
            
            const animateText = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                // Interpolate position
                const currentX = startX + (endX - startX) * easeProgress;
                const currentY = startY + (endY - startY) * easeProgress;
                text.setAttribute('x', currentX);
                text.setAttribute('y', currentY);
                
                // Interpolate size (20px -> 16px)
                const currentSize = 20 + (16 - 20) * easeProgress;
                text.style.fontSize = currentSize.toFixed(2) + 'px';
                
                // Interpolate rotation
                const currentRotation = startRotation + (endRotation - startRotation) * easeProgress;
                text.setAttribute('transform', `rotate(${currentRotation.toFixed(2)}, ${currentX}, ${currentY})`);
                
                if (progress < 1) {
                    requestAnimationFrame(animateText);
                } else {
                    // Final state
                    text.setAttribute('x', endX);
                    text.setAttribute('y', endY);
                    text.style.fontSize = '16px';
                    text.style.fontWeight = '600';
                    text.setAttribute('transform', `rotate(${endRotation}, ${endX}, ${endY})`);
                }
            };
            
            requestAnimationFrame(animateText);
            
            // Clean up after animation
            setTimeout(() => {
                animatedGroup.remove();
                if (magnifierRing) {
                    magnifierRing.style.display = '';
                }
            }, 600);
        }, 10);
        
        // Stage 5: Animate Parent Button off-screen (during IN migration)
        console.log('🎬 Stage 5: Checking for Parent Button to animate off-screen');
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        if (!parentButtonGroup) {
            console.log('🎬 Stage 5: Parent Button group not found');
        } else if (parentButtonGroup.classList.contains('hidden')) {
            console.log('🎬 Stage 5: Parent Button is hidden, skipping off-screen animation');
        } else {
            console.log('🎬 Stage 5: Animating Parent Button off-screen');
            const currentTransform = parentButtonGroup.getAttribute('transform');
            console.log('🎬 Stage 5: Current transform:', currentTransform);
            
            parentButtonGroup.style.transition = 'transform 600ms ease-in-out, opacity 600ms ease-in-out';
            parentButtonGroup.style.opacity = '0';
            
            // Move off-screen (further along 135° angle)
            const offScreenDistance = LSd * 0.5;
            const translateMatch = currentTransform && currentTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
            
            if (translateMatch) {
                const currentX = parseFloat(translateMatch[1]);
                const currentY = parseFloat(translateMatch[2]);
                const newX = currentX + offScreenDistance * Math.cos(parentButtonAngle);
                const newY = currentY + offScreenDistance * Math.sin(parentButtonAngle);
                
                console.log('🎬 Stage 5: Moving from', `(${currentX.toFixed(1)}, ${currentY.toFixed(1)})`, 'to', `(${newX.toFixed(1)}, ${newY.toFixed(1)})`);
                parentButtonGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
            } else {
                console.log('🎬 Stage 5: Could not parse transform, skipping position animation');
            }
            
            // Reset after animation
            setTimeout(() => {
                parentButtonGroup.style.transition = '';
                parentButtonGroup.style.opacity = '';
                parentButtonGroup.classList.add('hidden');
                console.log('🎬 Stage 5: Animation complete, Parent Button hidden');
            }, 600);
        }
    }

    /**
     * Stage 4: Animate Parent Button to Magnifier (OUT)
     * Reverse of Stage 3 - moves Parent Button content to become new Magnifier content
     * Used during OUT migration when navigating toward top level
     */
    animateParentButtonToMagnifier(parentItem) {
        if (!parentItem) {
            Logger.debug('🎬 No parent item to animate');
            return;
        }
        
        // Get start position (Parent Button)
        const viewport = this.viewport.getViewportInfo();
        const LSd = Math.max(viewport.width, viewport.height);
        const arcParams = this.viewport.getArcParameters();
        const parentButtonAngle = 135 * Math.PI / 180;
        const parentButtonRadius = 0.9 * LSd * Math.SQRT2;
        const startX = arcParams.centerX + parentButtonRadius * Math.cos(parentButtonAngle);
        const startY = arcParams.centerY + parentButtonRadius * Math.sin(parentButtonAngle);
        
        // Get end position (Magnifier)
        const magnifierPos = this.viewport.getMagnifyingRingPosition();
        const endX = magnifierPos.x;
        const endY = magnifierPos.y;
        const endAngle = magnifierPos.angle;
        
        // Calculate rotations
        let startRotation = 135;
        if (Math.cos(parentButtonAngle) < 0) startRotation += 180; // 315°
        
        let endRotation = endAngle * 180 / Math.PI;
        if (Math.cos(endAngle) < 0) endRotation += 180;
        
        // Create animated group
        const mainGroup = document.getElementById('mainGroup');
        const animatedGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        animatedGroup.classList.add('animating-parent-button');
        
        // Create circle
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('cx', startX);
        circle.setAttribute('cy', startY);
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.PARENT_BUTTON);
        circle.setAttribute('fill', this.renderer.getColor(parentItem.__level, parentItem.name));
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        
        // Create text - centered over circle
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        text.setAttribute('x', startX);
        text.setAttribute('y', startY);
        text.setAttribute('dy', '0.3em');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('transform', `rotate(${startRotation}, ${startX}, ${startY})`);
        text.setAttribute('fill', 'black');
        text.style.fontSize = '16px';
        text.style.fontWeight = '600';
        text.textContent = parentItem.name;
        
        animatedGroup.appendChild(circle);
        animatedGroup.appendChild(text);
        mainGroup.appendChild(animatedGroup);
        
        // Hide the actual Parent Button during animation
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        if (parentButtonGroup) {
            parentButtonGroup.style.display = 'none';
        }
        
        // Force reflow
        animatedGroup.getBoundingClientRect();
        
        // Start animation
        setTimeout(() => {
            // Animate circle via CSS transition
            circle.style.transition = 'cx 600ms ease-in-out, cy 600ms ease-in-out';
            circle.setAttribute('cx', endX);
            circle.setAttribute('cy', endY);
            
            // Animate text position, size, weight, and rotation
            const startTime = performance.now();
            const duration = 600;
            
            const animateText = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                // Interpolate position
                const currentX = startX + (endX - startX) * easeProgress;
                const currentY = startY + (endY - startY) * easeProgress;
                text.setAttribute('x', currentX);
                text.setAttribute('y', currentY);
                
                // Interpolate size (16px -> 20px)
                const currentSize = 16 + (20 - 16) * easeProgress;
                text.style.fontSize = currentSize.toFixed(2) + 'px';
                
                // Interpolate rotation
                const currentRotation = startRotation + (endRotation - startRotation) * easeProgress;
                text.setAttribute('transform', `rotate(${currentRotation.toFixed(2)}, ${currentX}, ${currentY})`);
                
                if (progress < 1) {
                    requestAnimationFrame(animateText);
                } else {
                    // Final state
                    text.setAttribute('x', endX);
                    text.setAttribute('y', endY);
                    text.style.fontSize = '20px';
                    text.style.fontWeight = 'bold';
                    text.setAttribute('transform', `rotate(${endRotation}, ${endX}, ${endY})`);
                }
            };
            
            requestAnimationFrame(animateText);
            
            // Clean up after animation
            setTimeout(() => {
                animatedGroup.remove();
                if (parentButtonGroup) {
                    parentButtonGroup.style.display = '';
                }
            }, 600);
        }, 10);
    }
    
    /**
     * Animate all sibling nodes from Child Pyramid to Focus Ring positions
     * This is the core IN migration animation
     * @param {Object} clickedItem - The item that was clicked
     * @param {Array} nodePositions - Array of {node, key, startX, startY} for all Child Pyramid nodes
     * @param {Array} allSiblings - All sibling items (data) for position calculation
     * @param {Function} onComplete - Callback when all animations complete
     */
    animateSiblingsToFocusRing(clickedItem, nodePositions, allSiblings, onComplete) {
        Logger.debug('🎬 Starting sibling migration animation');
        
        if (!allSiblings || allSiblings.length === 0) {
            Logger.warn('No siblings found for animation');
            if (onComplete) onComplete();
            return;
        }
        
        // Calculate Focus Ring parameters
        const clickedIndex = this.renderer.findItemIndexInArray(clickedItem, allSiblings, clickedItem.__level);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        const centerOffset = (clickedIndex - middleIndex) * angleStep;
        
        const centerAngle = this.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + centerOffset;
        const arcParams = this.viewport.getArcParameters();
        
        Logger.debug(`🎬 Focus Ring params: clickedIndex=${clickedIndex}, centerOffset=${(centerOffset * 180 / Math.PI).toFixed(1)}°`);
        
        const mainGroup = document.getElementById('mainGroup');
        const animatedNodes = [];
        
        // Create animated clones for each sibling
        nodePositions.forEach(nodePos => {
            // Find this node's item in siblings array
            const siblingIndex = allSiblings.findIndex(sib => sib.key === nodePos.key);
            if (siblingIndex === -1) {
                Logger.warn(`Node ${nodePos.key} not found in siblings array`);
                return;
            }
            
            const siblingItem = allSiblings[siblingIndex];
            
            // Calculate Focus Ring position for this sibling
            const angle = adjustedCenterAngle + (middleIndex - siblingIndex) * angleStep;
            const endPos = this.renderer.calculateFocusPosition(angle, arcParams);
            endPos.angle = angle;
            
            // Clone the node for animation
            const animatedNode = nodePos.node.cloneNode(true);
            animatedNode.classList.add('animating-node');
            mainGroup.appendChild(animatedNode);
            
            // Get the text element's existing rotation (Child Pyramid text is pre-rotated)
            const textElement = animatedNode.querySelector('text');
            let textStartRotation = 0;
            if (textElement) {
                const transformAttr = textElement.getAttribute('transform');
                const rotateMatch = transformAttr && transformAttr.match(/rotate\(([-\d.]+)/);
                if (rotateMatch) {
                    textStartRotation = parseFloat(rotateMatch[1]);
                }
            }
            
            // Calculate end rotation for Focus Ring (same logic as updateFocusItemText)
            let textEndRotation = angle * 180 / Math.PI;
            if (Math.cos(angle) < 0) {
                textEndRotation += 180;
            }
            
            // Calculate the rotation delta for the text (not the whole group)
            let textRotationDelta = textEndRotation - textStartRotation;
            
            // Normalize to [-180, 180] range to take shortest path
            while (textRotationDelta > 180) textRotationDelta -= 360;
            while (textRotationDelta < -180) textRotationDelta += 360;
            
            const translateX = endPos.x - nodePos.startX;
            const translateY = endPos.y - nodePos.startY;
            
            // Determine if this is the clicked node (will be centered at Magnifier)
            const isClickedNode = siblingItem.key === clickedItem.key;
            
            Logger.debug(`🎬 Node ${siblingItem.name}: translate(${translateX.toFixed(1)}, ${translateY.toFixed(1)}) rotate ${textRotationDelta.toFixed(1)}° ${isClickedNode ? '[CLICKED - will magnify]' : ''}`);
            
            // Get circle element for radius animation
            const circleElement = animatedNode.querySelector('.node');
            const startRadius = circleElement ? parseFloat(circleElement.getAttribute('r')) : MOBILE_CONFIG.RADIUS.CHILD_NODE;
            const endRadius = isClickedNode ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED;
            
            // Apply starting state
            animatedNode.style.transformOrigin = `${nodePos.startX}px ${nodePos.startY}px`;
            animatedNode.style.transform = 'translate(0, 0) rotate(0deg)';
            animatedNode.style.transition = 'none';
            
            // Store animation data
            animatedNodes.push({
                node: animatedNode,
                circle: circleElement,
                translateX,
                translateY,
                rotationDelta: textRotationDelta,
                startRadius,
                endRadius,
                itemName: siblingItem.name  // For logging
            });
        });
        
        // Force reflow
        if (animatedNodes.length > 0) {
            animatedNodes[0].node.getBoundingClientRect();
        }
        
        // Save animated nodes for potential OUT animation reuse - push to stack
        const currentLevel = allSiblings[0]?.__level || 'unknown';
        this.animatedNodesStack.push({
            level: currentLevel,
            nodes: animatedNodes
        });
        console.log(`🎬 Saved ${animatedNodes.length} animated nodes for level "${currentLevel}" (stack depth: ${this.animatedNodesStack.length})`);
        console.log('🎬⏰ IN animation setup complete at timestamp:', performance.now().toFixed(2), 'ms');
        
        const finalizeAnimatedNodes = () => {
            animatedNodes.forEach((anim, index) => {
                const computedTransform = window.getComputedStyle(anim.node).transform;
                console.log(`🎬🏁 IN[${index}] ${anim.itemName || 'unknown'} final computed transform: ${computedTransform}`);
                anim.node.style.opacity = '0';
            });
            console.log('🎬 IN animation END: Child Pyramid → Focus Ring');
            console.log('🎬⏰ Timestamp:', performance.now().toFixed(2), 'ms');
            if (onComplete) onComplete();
        };
        
        const handlePostAnimation = () => {
            if (this.loopInOutDebugFlag) {
                this.runInOutInDebugLoop(animatedNodes, finalizeAnimatedNodes);
            } else {
                finalizeAnimatedNodes();
            }
        };

        // Start all animations - simple IN without demonstration loop
        setTimeout(() => {
            animatedNodes.forEach(anim => {
                anim.node.style.transition = 'transform 600ms ease-in-out';
                anim.node.style.transform = `translate(${anim.translateX}px, ${anim.translateY}px) rotate(${anim.rotationDelta}deg)`;
                
                // Animate circle radius
                if (anim.circle && anim.startRadius !== anim.endRadius) {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', anim.endRadius);
                }
            });
            
            // Do NOT remove nodes - keep them for potential OUT animation
            setTimeout(handlePostAnimation, 600);
        }, 10);
    }
    
    /**
     * OUT MIGRATION: Animate Focus Ring nodes back to Child Pyramid positions
     * This is the reverse of animateSiblingsToFocusRing
     * Used when Parent Button is clicked to navigate OUT to parent level
     * 
     * @param {Array} focusItems - Current items in Focus Ring (data)
     * @param {Object} focusRingGroup - Focus Ring SVG group element
     * @param {Object} magnifierElement - Magnifier SVG element
     * @param {Function} onComplete - Callback after animation completes
     */
    animateFocusRingToChildPyramid(focusItems, focusRingGroup, magnifierElement, onComplete) {
        console.log('🎬🎬🎬 OUT MIGRATION FUNCTION CALLED');
        console.log('🎬 focusItems:', focusItems?.length);
        console.log('🎬 animatedNodesStack depth:', this.animatedNodesStack.length);
        Logger.debug('🎬 Starting OUT migration: Focus Ring → Child Pyramid');
        
        if (!focusItems || focusItems.length === 0) {
            console.log('🎬❌ No focus items for OUT animation');
            Logger.warn('No focus items for OUT animation');
            if (onComplete) onComplete();
            return;
        }
        
        // Pop the most recent animated nodes from stack (LIFO - last in, first out)
        if (this.animatedNodesStack.length === 0) {
            console.log('🎬❌ No saved animated nodes in stack for OUT animation');
            Logger.warn('No saved animated nodes for OUT animation');
            if (onComplete) onComplete();
            return;
        }
        
        const stackEntry = this.animatedNodesStack.pop();
        const animatedNodes = stackEntry.nodes;
        console.log(`🎬✓ Popped ${animatedNodes.length} animated nodes from level "${stackEntry.level}" (remaining stack depth: ${this.animatedNodesStack.length})`);
        
        // Hide original Focus Ring nodes during animation (but keep the gray band visible)
        if (focusRingGroup) {
            // Hide all focus nodes but preserve the background band
            Array.from(focusRingGroup.children).forEach(child => {
                if (child.id !== 'focusRingBackground') {
                    child.style.opacity = '0';
                }
            });
            console.log('🎬👁️ Hidden Focus Ring nodes during OUT animation (band remains visible)');
        }
        
        // Hide magnifier stroke during OUT animation
        if (magnifierElement) {
            magnifierElement.style.opacity = '0';
            console.log('🎬👁️ Hidden Magnifier stroke during OUT animation');
        }
        
        // Make nodes visible and animate back to Child Pyramid (reverse of IN animation)
        setTimeout(() => {
            animatedNodes.forEach(anim => {
                // Make visible first
                anim.node.style.opacity = '1';
                anim.node.style.transition = 'transform 600ms ease-in-out, opacity 0ms';
                anim.node.style.transform = `translate(0, 0) rotate(0deg)`;
                
                // Animate circle radius back to Child Pyramid size
                if (anim.circle && anim.startRadius !== anim.endRadius) {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', anim.startRadius);
                }
            });
            
            // Clean up when animation completes - remove nodes to allow fresh Child Pyramid rendering
            setTimeout(() => {
                console.log('🎬 OUT animation complete - removing animated nodes');
                
                // Remove the animated nodes - they block new Child Pyramid content
                animatedNodes.forEach((anim, index) => {
                    const itemName = anim.itemName || `node-${index}`;
                    console.log(`🎬🗑️ Removing animated node[${index}]: ${itemName}`);
                    anim.node.remove();
                });
                
                Logger.debug('🎬 OUT migration animation complete, nodes removed');
                console.log('🎬 OUT animation complete, animated nodes removed from DOM');
                console.log('🎬 Child Pyramid can now render fresh content for selected Focus Ring item');
                if (onComplete) onComplete();
            }, 600);
        }, 10);
    }
    
    /**
     * Debug loop that cycles IN→OUT→IN animations for demonstration
     * Used for visual debugging and testing animation transitions
     * @param {Array} animatedNodes - Array of animation data objects
     * @param {Function} done - Callback when loop completes
     */
    runInOutInDebugLoop(animatedNodes, done) {
        if (!animatedNodes || animatedNodes.length === 0) {
            done();
            return;
        }

        console.log('🎬 LOOP playback initiated (Child Pyramid ↔ Focus Ring)');

        const phases = [
            {
                label: 'OUT (loop)',
                transformFn: () => 'translate(0px, 0px) rotate(0deg)',
                radiusProp: 'startRadius'
            },
            {
                label: 'IN (loop)',
                transformFn: (anim) => `translate(${anim.translateX}px, ${anim.translateY}px) rotate(${anim.rotationDelta}deg)`,
                radiusProp: 'endRadius'
            }
        ];

        let phaseIndex = 0;

        const startPhase = () => {
            if (phaseIndex >= phases.length) {
                animatedNodes.forEach(anim => {
                    anim.node.style.opacity = '0';
                });
                console.log('🎬 LOOP sequence complete (IN/OUT/IN)');
                done();
                return;
            }

            const phase = phases[phaseIndex];
            console.log(`🎬 LOOP animation START: ${phase.label}`);
            animatedNodes.forEach(anim => {
                anim.node.style.opacity = '1';
                anim.node.style.transition = 'transform 600ms ease-in-out';
                anim.node.style.transform = phase.transformFn(anim);
                const radiusValue = anim[phase.radiusProp];
                if (anim.circle && typeof radiusValue === 'number') {
                    anim.circle.style.transition = 'r 600ms ease-in-out';
                    anim.circle.setAttribute('r', radiusValue);
                }
            });

            setTimeout(() => {
                console.log(`🎬 LOOP animation END: ${phase.label}`);
                phaseIndex += 1;
                startPhase();
            }, 600);
        };

        // Ensure nodes remain visible for playback
        animatedNodes.forEach(anim => {
            anim.node.style.opacity = '1';
        });

        startPhase();
    }
    
    /**
     * Get current stack depth (for debugging/monitoring)
     * @returns {number} Number of levels in animation stack
     */
    getStackDepth() {
        return this.animatedNodesStack.length;
    }
    
    /**
     * Clear animation stack (use when resetting navigation)
     */
    clearStack() {
        // Remove any remaining animated nodes from DOM
        this.animatedNodesStack.forEach(entry => {
            entry.nodes.forEach(anim => {
                if (anim.node && anim.node.parentNode) {
                    anim.node.remove();
                }
            });
        });
        this.animatedNodesStack = [];
        Logger.debug('🎬 Animation stack cleared');
    }
}

export { MobileAnimation };
