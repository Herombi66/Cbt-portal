
describe('Exam Form Controls', () => {
  beforeEach(() => {
    // Assuming standard login or state setup
    cy.visit('/admin'); // or appropriate route
    cy.get('button').contains('Create Exam').click();
  });

  it('should randomize questions when toggle is clicked', () => {
    // 1. Initial order check
    const initialQuestions = [];
    cy.get('div[style*="max-height: 180px"] label span')
      .each(($el) => initialQuestions.push($el.text()))
      .then(() => {
        // 2. Click randomize button (🎲)
        cy.get('button[aria-label="Randomize Questions"]').click();

        // 3. New order check
        const shuffledQuestions = [];
        cy.get('div[style*="max-height: 180px"] label span')
          .each(($el) => shuffledQuestions.push($el.text()))
          .then(() => {
            expect(JSON.stringify(shuffledQuestions)).not.to.equal(JSON.stringify(initialQuestions));
          });
      });
  });

  it('should persist randomization state across reloads', () => {
    cy.get('button[aria-label="Randomize Questions"]').click().then(() => {
      expect(localStorage.getItem('exam_randomEnabled')).to.equal('true');
      cy.reload();
      // Re-open modal if needed
      cy.get('button').contains('Create Exam').click();
      cy.get('button[aria-label="Randomize Questions"]').should('have.attr', 'aria-pressed', 'true');
    });
  });

  it('should toggle select all / deselect all', () => {
    const questionsCount = 0;
    cy.get('div[style*="max-height: 180px"] input[type="checkbox"]').then(($els) => {
      const count = $els.length;
      if (count === 0) return; // skip if no questions

      // 1. Initial state (should be 0 selected)
      cy.get('p').contains('Select Questions (0 selected)').should('exist');

      // 2. Click Select All (⬜)
      cy.get('button[aria-label="Select All"]').click();
      cy.get('p').contains(`Select Questions (${count} selected)`).should('exist');
      cy.get('button[aria-label="Deselect All"]').should('exist');

      // 3. Click Deselect All (☑️)
      cy.get('button[aria-label="Deselect All"]').click();
      cy.get('p').contains('Select Questions (0 selected)').should('exist');
      cy.get('button[aria-label="Select All"]').should('exist');
    });
  });

  it('should emit exam:selectall custom event', () => {
    cy.window().then((win) => {
      const spy = cy.spy();
      win.addEventListener('exam:selectall', spy);
      cy.get('button[aria-label="Select All"]').click().then(() => {
        expect(spy).to.be.calledWithMatch({ detail: true });
      });
    });
  });
});
