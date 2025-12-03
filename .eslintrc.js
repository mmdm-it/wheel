/**
 * ESLint Configuration for Wheel
 * 
 * Includes custom rules to prevent domain-specific code from being introduced.
 * This keeps the codebase volume-agnostic.
 */

module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        // Standard rules
        'no-unused-vars': 'warn',
        'no-console': 'off', // Allow console for debugging
        
        // Domain-specific term detection
        // These patterns should not appear in code (except in comments or JSON filenames)
        'no-restricted-syntax': [
            'warn',
            {
                // Detect hardcoded volume-specific level names in code
                selector: "Literal[value=/\\b(manufacturer|engine_model|artist|album|song)\\b/i]",
                message: "Avoid hardcoded domain-specific terms. Use generic names like 'topAncestor', 'item.name', or config-driven values."
            },
            {
                // Detect volume_name === checks (should use config flags instead)
                selector: "BinaryExpression[operator='==='][left.property.name='volume_name']",
                message: "Avoid volume_name checks. Use config flags like 'detail_sector.skip_header' or 'detail_sector.mode' instead."
            },
            {
                // Detect direct property access to domain-specific fields
                selector: "MemberExpression[property.name='manufacturer']",
                message: "Avoid accessing domain-specific properties directly. Use getItemDisplayName() or config-driven field names."
            },
            {
                // Detect direct property access to engine_model
                selector: "MemberExpression[property.name='engine_model']",
                message: "Avoid accessing engine_model directly. Use getItemDisplayName() helper instead."
            }
        ]
    },
    
    overrides: [
        {
            // Relax rules for test files
            files: ['**/test-*.js', '**/*.test.js'],
            rules: {
                'no-restricted-syntax': 'off'
            }
        }
    ],
    
    // Ignore JSON files and external dependencies
    ignorePatterns: [
        '*.json',
        'old/**',
        'archive/**',
        'node_modules/**'
    ]
};
