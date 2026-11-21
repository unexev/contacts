import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { db } from './db';
import { toDisplay } from './contactUtils';
import { createContactsActions } from './contactsActions';
import type { Contact, ContactsContextType } from './contactsTypes';
import { syncNow as syncNowApi } from './apiSync';
import { useAuth } from './authContext';
import { PRIMARY_CONTACT_COLUMNS } from './contactActions';

export const DB_NAME = 'contacts.db';

// No-op: la inicialización ocurre en db.native.ts (Android/iOS) y db.ts (web/desktop)
export async function initializeDatabase() {}

export type {
    Contact,
    ContactBankAccount,
    ContactEmail,
    ContactLocation,
    ContactNationality,
    ContactInput,
    ContactKeyword,
    ContactNote,
    ContactOrganization,
    ContactPhone,
    ContactsContextType,
    ContactUrl,
    IdentityCard,
    MaritalStatus,
    Relationship,
    RelationshipType,
} from './contactsTypes';

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: ReactNode }) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoading, setContactsLoading] = useState(true);

    const normalizeContact = useCallback((contact: Contact): Contact => ({
        ...contact,
        first_name: toDisplay(contact.first_name),
        middle_name: contact.middle_name ? toDisplay(contact.middle_name) : contact.middle_name,
        surname: toDisplay(contact.surname),
    }), []);

    const fetchContacts = useCallback(async (): Promise<Contact[]> => {
        try {
            const result = await db.getAllAsync<Contact>(`SELECT c.*, c.rowid, ${PRIMARY_CONTACT_COLUMNS} FROM contact c ORDER BY c.first_name ASC;`);
            const normalized = result.map(normalizeContact);
            setContacts(normalized);
            return normalized;
        } catch (e) {
            console.error(e);
            return [];
        } finally {
            setContactsLoading(false);
        }
    }, [normalizeContact]);

    const actions = useMemo(
        () => createContactsActions({ fetchContacts, normalizeContact }),
        [fetchContacts, normalizeContact]
    );

    // Load contacts once on mount so any screen (e.g. calendar opened directly) has data.
    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    // ── Sincronización con el backend propio (sesión email/contraseña) ───────────
    // Corre al iniciar sesión, al abrir la app con una sesión guardada y al volver a primer plano.
    const { apiSession } = useAuth();
    const apiSyncing = useRef(false);

    const runApiSync = useCallback(async () => {
        if (apiSyncing.current) return;
        apiSyncing.current = true;
        try {
            const res = await syncNowApi();
            if (res.error) console.warn('[apiSync] sync falló:', res.error);
            if (res.changed) await fetchContacts();
        } catch (e) {
            console.warn('[apiSync] sync falló:', e);
        } finally {
            apiSyncing.current = false;
        }
    }, [fetchContacts]);

    useEffect(() => {
        if (!apiSession) return;
        void runApiSync();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') void runApiSync();
        });
        return () => sub.remove();
    }, [apiSession, runApiSync]);

    // Al cerrar una sesión API la DB local se vacía: refrescar la lista en memoria.
    const prevApiSession = useRef(apiSession);
    useEffect(() => {
        if (prevApiSession.current && !apiSession) void fetchContacts();
        prevApiSession.current = apiSession;
    }, [apiSession, fetchContacts]);

    const value = useMemo<ContactsContextType>(() => ({
        contacts,
        contactsLoading,
        ...actions,
    }), [contacts, contactsLoading, actions]);

    return (
        <ContactsContext.Provider value={value}>
            {children}
        </ContactsContext.Provider>
    );
}

export function useContacts() {
    const context = useContext(ContactsContext);
    if (!context) {
        throw new Error('useContacts must be used within a ContactsProvider');
    }
    return context;
}
