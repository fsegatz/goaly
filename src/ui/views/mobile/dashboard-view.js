// src/ui/views/mobile/dashboard-view.js

import { DashboardView } from '../dashboard-view.js';


export class MobileDashboardView extends DashboardView {
    constructor(app) {
        super(app);
        this.currentIndex = 0;
        this.cards = [];
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.touchCurrentX = 0;
        this.isDragging = false;
        this.minSwipeDistance = 50;
        this.dragOffset = 0;
    }

    render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal) {
        this.openPauseModal = openPauseModal;
        const { dashboardList, allCards } = this._getRenderData();

        // Handle empty state
        if (allCards.length === 0) {
            this._renderEmptyState(dashboardList);
            return;
        }

        // Manage index consistency
        this._updateCurrentIndex(allCards.length);

        // Clear list and remove old indicators
        dashboardList.innerHTML = '';
        this._removeIndicators();

        // Create and append cards
        const { swipeContainer, cardsWrapper } = this._createSwipeContainer();
        this.cards = [];

        allCards.forEach((cardItem, index) => {
            const cardElement = this._createCardElement(
                cardItem,
                openCompletionModal,
                updateGoalInline,
                openGoalForm,
                handleReviewSubmit,
                renderViews
            );

            this._applyInitialCardStyle(cardElement, index);
            cardsWrapper.appendChild(cardElement);
            this.cards.push(cardElement);
        });

        // Finalize DOM
        this.dragOffset = 0;
        this.isDragging = false;
        swipeContainer.appendChild(cardsWrapper);
        dashboardList.appendChild(swipeContainer);

        this._setupIndicators();
        this.setupSwipeHandlers(swipeContainer);

        // Ensure layout consistency
        setTimeout(() => {
            this.resetCardPositions();
            this.updateWrapperHeight();
        }, 0);
    }

    /** @private */
    _renderEmptyState(container) {
        // Call parent's empty state rendering
        super._renderEmptyState(container);
        // Reset mobile-specific state
        this.cards = [];
        this.currentIndex = 0;
    }

    /** @private */
    _updateCurrentIndex(totalCards) {
        const previousIndex = this.currentIndex;
        if (totalCards === 0) {
            this.currentIndex = 0;
        } else if (previousIndex >= totalCards) {
            this.currentIndex = Math.max(0, totalCards - 1);
        }
    }

    /** @private */
    _removeIndicators() {
        const existingIndicators = document.querySelector('.mobile-dashboard-indicators');
        if (existingIndicators) {
            existingIndicators.remove();
        }
    }

    /** @private */
    _createSwipeContainer() {
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'mobile-dashboard-swipe-container';

        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'mobile-dashboard-cards-wrapper';

        return { swipeContainer, cardsWrapper };
    }

    /** @private */
    _createCardElement(cardItem, openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews) {
        let cardElement;
        if (cardItem.type === 'review') {
            cardElement = this.createReviewCard(
                cardItem.data,
                cardItem.position,
                cardItem.total,
                openGoalForm,
                handleReviewSubmit,
                renderViews
            );
        } else {
            cardElement = this.createGoalCard(cardItem.data, openCompletionModal, updateGoalInline);
        }
        cardElement.classList.add('mobile-dashboard-card');
        return cardElement;
    }

    /** @private */
    _applyInitialCardStyle(cardElement, index) {
        if (index === this.currentIndex) {
            cardElement.style.transform = 'translateX(0%)';
            cardElement.style.opacity = '1';
            cardElement.style.position = 'relative';
            cardElement.classList.add('mobile-dashboard-card-visible');
        } else {
            const offset = index < this.currentIndex ? -100 : 100;
            cardElement.style.transform = `translateX(${offset}%)`;
            cardElement.style.opacity = '0';
            cardElement.style.position = 'absolute';
            cardElement.classList.add('mobile-dashboard-card-hidden');
        }
    }

    /** @private */
    _setupIndicators() {
        if (this.cards.length <= 1) return;

        const indicators = document.createElement('div');
        indicators.className = 'mobile-dashboard-indicators';

        for (let i = 0; i < this.cards.length; i++) {
            const indicator = document.createElement('button');
            indicator.className = 'mobile-dashboard-indicator';
            indicator.setAttribute('aria-label', `Go to card ${i + 1}`);
            if (i === this.currentIndex) {
                indicator.classList.add('active');
            }
            indicator.addEventListener('click', () => {
                this.goToCard(i);
            });
            indicators.appendChild(indicator);
        }
        document.body.appendChild(indicators);
    }

    setupSwipeHandlers(container) {
        const cardsWrapper = container.querySelector('.mobile-dashboard-cards-wrapper');
        if (!cardsWrapper) {
            return;
        }

        let touchStartY = 0;

        // Touch events for mobile
        cardsWrapper.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = this.touchStartX;
            touchStartY = e.touches[0].clientY;
            this.isDragging = false;
            this.dragOffset = 0;
            // Remove transition during drag for smooth movement
            this.cards.forEach(card => {
                card.style.transition = 'none';
            });
        }, { passive: true });

        cardsWrapper.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - this.touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);

            // Check if touch is on a scrollable element (steps list)
            const target = e.target;
            const isScrollableElement = target.closest('.goal-steps-list') ||
                target.closest('.goal-description') ||
                target.closest('.review-card__fields');

            // Only prevent default and handle swipe if:
            // 1. Horizontal movement is greater than vertical (swipe gesture)
            // 2. Not touching a scrollable element
            // 3. Movement is significant enough
            if (!isScrollableElement && deltaX > deltaY && deltaX > 10) {
                e.preventDefault();
                this.isDragging = true;
                this.touchCurrentX = touch.clientX;
                this.dragOffset = this.touchCurrentX - this.touchStartX;
                this.updateCardPositions();
            }
        }, { passive: false });

        cardsWrapper.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].clientX;
            // Restore transitions
            this.cards.forEach(card => {
                card.style.transition = '';
            });
            this.handleSwipe();
        }, { passive: true });

        cardsWrapper.addEventListener('touchcancel', () => {
            // Restore transitions
            this.cards.forEach(card => {
                card.style.transition = '';
            });
            this.resetCardPositions();
        }, { passive: true });

        // Mouse events for desktop testing
        let mouseStartX = 0;
        let isMouseDown = false;

        cardsWrapper.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            mouseStartX = e.clientX;
            this.touchStartX = e.clientX;
            this.touchCurrentX = e.clientX;
            this.isDragging = false;
            this.dragOffset = 0;
            // Remove transition during drag
            this.cards.forEach(card => {
                card.style.transition = 'none';
            });
        });

        cardsWrapper.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            const deltaX = Math.abs(e.clientX - mouseStartX);
            if (deltaX > 10) {
                e.preventDefault();
                this.isDragging = true;
                this.touchCurrentX = e.clientX;
                this.dragOffset = this.touchCurrentX - this.touchStartX;
                this.updateCardPositions();
            }
        });

        cardsWrapper.addEventListener('mouseup', (e) => {
            if (!isMouseDown) return;
            isMouseDown = false;
            // Restore transitions
            this.cards.forEach(card => {
                card.style.transition = '';
            });
            const mouseEndX = e.clientX;
            const deltaX = mouseEndX - mouseStartX;
            if (Math.abs(deltaX) > this.minSwipeDistance) {
                if (deltaX > 0) {
                    this.goToPreviousCard();
                } else {
                    this.goToNextCard();
                }
            } else {
                this.resetCardPositions();
            }
        });

        cardsWrapper.addEventListener('mouseleave', () => {
            if (isMouseDown) {
                isMouseDown = false;
                // Restore transitions
                this.cards.forEach(card => {
                    card.style.transition = '';
                });
                this.resetCardPositions();
            }
        });
    }

    updateCardPositions() {
        if (this.cards.length === 0) return;

        const containerWidth = this.cards[0].closest('.mobile-dashboard-swipe-container')?.offsetWidth || window.innerWidth;
        const dragPercentage = this.dragOffset / containerWidth;
        const absDragPercentage = Math.abs(dragPercentage);

        this.cards.forEach((card, index) => {
            const offset = index - this.currentIndex;
            const baseOffset = offset * 100;
            const dragOffset = dragPercentage * 100;
            const totalOffset = baseOffset + dragOffset;

            // Determine which card should be visible
            const isCurrentCard = index === this.currentIndex;
            const isNextCard = dragPercentage < 0 && index === this.currentIndex + 1;
            const isPrevCard = dragPercentage > 0 && index === this.currentIndex - 1;

            card.style.transform = `translateX(${totalOffset}%)`;

            if (isCurrentCard) {
                // Current card fades out as you drag
                card.style.opacity = Math.max(0.3, 1 - absDragPercentage);
            } else if (isNextCard || isPrevCard) {
                // Adjacent card fades in as you drag
                card.style.opacity = Math.min(1, absDragPercentage);
                card.classList.remove('mobile-dashboard-card-hidden');
            } else {
                // Other cards stay hidden
                card.style.opacity = '0';
                card.classList.add('mobile-dashboard-card-hidden');
            }
        });
    }

    resetCardPositions() {
        this.dragOffset = 0;
        this.isDragging = false;
        this.cards.forEach((card, index) => {
            if (index === this.currentIndex) {
                card.style.transform = 'translateX(0%)';
                card.style.opacity = '1';
                card.style.position = 'relative';
                card.classList.remove('mobile-dashboard-card-hidden');
                card.classList.add('mobile-dashboard-card-visible');
            } else {
                const offset = index < this.currentIndex ? -100 : 100;
                card.style.transform = `translateX(${offset}%)`;
                card.style.opacity = '0';
                card.style.position = 'absolute';
                card.classList.remove('mobile-dashboard-card-visible');
                card.classList.add('mobile-dashboard-card-hidden');
            }
        });
        this.updateWrapperHeight();
    }

    updateWrapperHeight() {
        if (this.cards.length === 0) return;
        const currentCard = this.cards[this.currentIndex];
        if (!currentCard) return;

        const wrapper = currentCard.closest('.mobile-dashboard-cards-wrapper');
        if (wrapper) {
            // Force a reflow to ensure card is measured correctly
            currentCard.offsetHeight; // eslint-disable-line no-unused-expressions
            // Reset height to auto to measure natural height
            wrapper.style.height = 'auto';
            // Get the natural height of the card
            const cardHeight = currentCard.offsetHeight;
            // Set wrapper height to match card height, with a minimum
            wrapper.style.height = `${Math.max(cardHeight, 400)}px`;
        }
    }

    handleSwipe() {
        const deltaX = this.touchStartX - this.touchEndX;

        if (Math.abs(deltaX) > this.minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe left (next card)
                this.goToNextCard();
            } else {
                // Swipe right (previous card)
                this.goToPreviousCard();
            }
        } else {
            this.resetCardPositions();
        }
    }

    goToPreviousCard() {
        if (this.currentIndex > 0) {
            this.goToCard(this.currentIndex - 1);
        }
    }

    goToNextCard() {
        if (this.currentIndex < this.cards.length - 1) {
            this.goToCard(this.currentIndex + 1);
        }
    }

    goToCard(index) {
        if (index < 0 || index >= this.cards.length) {
            return;
        }

        this.currentIndex = index;

        // Reset drag state
        this.dragOffset = 0;
        this.isDragging = false;

        // Animate cards sliding
        this.cards.forEach((card, i) => {
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

            if (i === index) {
                card.style.transform = 'translateX(0%)';
                card.style.opacity = '1';
                card.style.position = 'relative';
                card.classList.remove('mobile-dashboard-card-hidden');
                card.classList.add('mobile-dashboard-card-visible');
            } else if (i < index) {
                // Card is to the left (already passed)
                card.style.transform = 'translateX(-100%)';
                card.style.opacity = '0';
                card.style.position = 'absolute';
                card.classList.remove('mobile-dashboard-card-visible');
                card.classList.add('mobile-dashboard-card-hidden');
            } else {
                // Card is to the right (upcoming)
                card.style.transform = 'translateX(100%)';
                card.style.opacity = '0';
                card.style.position = 'absolute';
                card.classList.remove('mobile-dashboard-card-visible');
                card.classList.add('mobile-dashboard-card-hidden');
            }
        });

        // Update indicators
        const indicators = document.querySelectorAll('.mobile-dashboard-indicator');
        indicators.forEach((indicator, i) => {
            if (i === index) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });

        // Update wrapper height after transition
        setTimeout(() => {
            this.updateWrapperHeight();
        }, 300);
    }

    destroy() {
        this._removeIndicators();
    }
}

