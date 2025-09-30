// ==UserScript==
// @name         DeepFlood+ 助手
// @namespace    https://www.deepflood.com/
// @version      0.1.0
// @description  DeepFlood 论坛增强脚本（基于 NSaide 改造）
// @author       
// @license      GPL-3.0
// @match        https://www.deepflood.com/*
// @icon         https://www.deepflood.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_info
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==
(function() {
    'use strict';

    console.log('[DF助手] 脚本开始加载');

    const CONFIG_URL = 'https://raw.githubusercontent.com/zen1zi/DeepFloodPlus/main/modules/config.json';
    const CACHE_EXPIRY = 30 * 60 * 1000;
    const CACHE_KEY_PREFIX = 'df_module_cache_';
    const CONFIG_CACHE_KEY = 'df_config_cache';

    const getCachedData = (key) => {
        const cached = GM_getValue(key);
        if (!cached) return null;

        try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > CACHE_EXPIRY) {
                GM_setValue(key, '');
                return null;
            }
            return data;
        } catch {
            return null;
        }
    };

    const setCachedData = (key, data) => {
        GM_setValue(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    };

    const fetchWithCache = (url, cacheKey) => {
        return new Promise((resolve, reject) => {
            const cached = getCachedData(cacheKey);
            if (cached) {
                console.log(`[DF助手] 使用缓存数据: ${cacheKey}`);
                resolve(cached);
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: `${url}?t=${Date.now()}`,
                nocache: true,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = response.responseText;
                            setCachedData(cacheKey, data);
                            resolve(data);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error(`请求失败: ${response.status}`));
                    }
                },
                onerror: reject
            });
        });
    };

    const loadConfig = async () => {
        try {
            const configText = await fetchWithCache(CONFIG_URL, CONFIG_CACHE_KEY);
            return JSON.parse(configText);
        } catch (error) {
            console.error('[DF助手] 配置加载失败:', error);
            throw error;
        }
    };

    const loadModule = async (moduleInfo) => {
        const cacheKey = `${CACHE_KEY_PREFIX}${moduleInfo.id}`;
        try {
            console.log(`[DF助手] 开始加载模块: ${moduleInfo.name}`);
            const moduleCode = await fetchWithCache(moduleInfo.url, cacheKey);
            eval(moduleCode);
            console.log(`[DF助手] 模块加载成功: ${moduleInfo.name}`);
        } catch (error) {
            console.error(`[DF助手] 模块 ${moduleInfo.name} 加载失败:`, error);
            throw error;
        }
    };

    const createDF = () => {
        window.DF = {
            version: GM_info.script.version,
            modules: new Map(),
            isReady: false,

            registerModule(moduleDefinition) {
                if (!moduleDefinition || !moduleDefinition.id || !moduleDefinition.init) return;

                const module = {
                    ...moduleDefinition,
                    enabled: GM_getValue(`module_${moduleDefinition.id}_enabled`, true)
                };

                this.modules.set(moduleDefinition.id, module);
                console.log(`[DF助手] 模块已注册: ${module.name}`);
            },

            init() {
                if (this.isReady) return;

                const enabledModules = Array.from(this.modules.values()).filter(m => m.enabled);
                console.log(`[DF助手] 开始初始化 ${enabledModules.length} 个已启用模块`);

                Promise.all(enabledModules.map(module =>
                    new Promise(resolve => {
                        try {
                            module.init();
                            console.log(`[DF助手] 模块初始化成功: ${module.name}`);
                            resolve();
                        } catch (error) {
                            console.error(`[DF助手] 模块 ${module.name} 初始化失败:`, error);
                            resolve();
                        }
                    })
                )).then(() => {
                    this.isReady = true;
                    console.log('[DF助手] 所有模块初始化完成');
                });
            }
        };

        window.DFRegisterModule = (moduleDefinition) => {
            window.DF.registerModule(moduleDefinition);
        };
    };

    const initializeModules = async () => {
        try {
            createDF();
            const config = await loadConfig();

            await Promise.all(config.modules.map(loadModule));

            if (window.DF.modules.size > 0) {
                window.DF.init();
            }
        } catch (error) {
            console.error('[DF助手] 初始化失败:', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeModules);
    } else {
        initializeModules();
    }
})();
