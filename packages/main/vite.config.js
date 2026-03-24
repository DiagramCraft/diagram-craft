/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
export default defineConfig(function (_a) {
    var command = _a.command, mode = _a.mode, isSsrBuild = _a.isSsrBuild, isPreview = _a.isPreview;
    // https://vitejs.dev/config/
    var userConfig = {
        base: './',
        plugins: [react(), yaml()],
        build: {
            rolldownOptions: {
                transform: {},
                output: {
                    manualChunks: function (id) {
                        if (id.includes('embeddable-jq')) {
                            return 'embeddable-jq';
                        }
                        else if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                        else if (id.includes('sample/')) {
                            return 'sample-data';
                        }
                    }
                }
            }
        },
        css: {
            modules: {
                exportGlobals: true,
                localsConvention: 'camelCase'
            }
        },
        resolve: {
            tsconfigPaths: true
        }
    };
    if (command === 'serve') {
        return userConfig;
    }
    else {
        userConfig.build.rolldownOptions.transform.dropLabels = ['DEBUG'];
        return userConfig;
    }
});
