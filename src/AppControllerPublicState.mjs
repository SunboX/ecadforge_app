/**
 * Projects the stable public subset of AppController state.
 */
export class AppControllerPublicState {
    /**
     * Resolves the integration-safe public state snapshot.
     * @param {object} snapshot Complete application state.
     * @returns {{ app: string, activeView: string, locale: string, parseStatus: string, activeFileName: string }}
     */
    static resolve(snapshot) {
        return {
            app: 'ECAD Forge',
            activeView: snapshot.activeView,
            locale: snapshot.locale,
            parseStatus: snapshot.parseStatus,
            activeFileName: snapshot.activeFileName
        }
    }
}
