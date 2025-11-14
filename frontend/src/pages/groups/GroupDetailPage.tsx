import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, message, Modal, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { studyGroupService } from '../../services/studyGroup.service';
import { StudyGroupSidebar } from '../../components/studyGroup/StudyGroupSidebar';
import { GroupDetailsTab } from '../../components/studyGroup/GroupDetailsTab';
import { ChatTab } from '../../components/studyGroup/ChatTab';
import { DocumentsTab } from '../../components/studyGroup/DocumentsTab';
import { InviteMemberModal } from '../../components/email/InviteMemberModal';
import type { StudyGroup } from '../../types/studyGroup.types';
import { useAuth } from '../../hooks/useAuth';

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'documents'>('details');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState(0);

  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadMembers();
    }
  }, [groupId]);

  // Poll member status every 10 seconds to update online count
  useEffect(() => {
    if (!groupId) return;

    const interval = setInterval(() => {
      // Silently refresh member list to update online status
      loadMembersQuietly();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [groupId]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const data = await studyGroupService.getGroup(Number(groupId));
      setGroup(data);
    } catch (error) {
      message.error('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      const membersList = await studyGroupService.getGroupMembers(Number(groupId));
      setMembers(membersList);
      // Count online members
      const onlineCount = membersList.filter((m: any) => m.isOnline).length;
      setOnlineMembers(onlineCount);
    } catch (error) {
      console.log('Could not load members', error);
    } finally {
      setMembersLoading(false);
    }
  };

   // Silent refresh without showing loading spinner
  const loadMembersQuietly = async () => {
    try {
      const membersList = await studyGroupService.getGroupMembers(Number(groupId));
      setMembers(membersList);
      const onlineCount = membersList.filter((m: any) => m.isOnline).length;
      setOnlineMembers(onlineCount);
    } catch (error) {
      // Silently fail - don't show error to user
      console.log('Background member refresh failed', error);
    }
  };

  const handleLeave = () => {
    Modal.confirm({
      title: 'Leave Study Group',
      content: 'Are you sure you want to leave this study group?',
      okText: 'Leave',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.leaveGroup(Number(groupId));
          message.success('Left the group successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to leave group');
        }
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Study Group',
      content:
        'Are you sure you want to delete this study group? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.deleteGroup(Number(groupId));
          message.success('Group deleted successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to delete group');
        }
      },
    });
  };

  const handleEdit = () => {
    navigate(`/groups/${groupId}/edit`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatTab groupId={Number(groupId)} />;
      case 'documents':
        return (
          <DocumentsTab
            groupId={Number(groupId)}
            isAdmin={group?.is_admin || false}
            currentUserId={user?.id || ''}
          />
        );
      case 'details':
      default:
        return (
          <GroupDetailsTab
            group={group}
            loading={loading}
            members={members}
            membersLoading={membersLoading}
          />
        );
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', marginTop: '64px' }}>
      {/* Header */}
      <Layout.Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          height: '64px',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/groups')}
        >
          Back to Groups
        </Button>
        <h2 style={{ margin: 0, flex: 1 }}>
          {loading ? 'Loading...' : group?.name}
        </h2>
      </Layout.Header>

      {/* Sidebar Navigation */}
      {!loading && group && (
        <StudyGroupSidebar
          groupId={Number(groupId)}
          group={group}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onEdit={handleEdit}
          onInvite={() => setInviteModalVisible(true)}
          onDelete={handleDelete}
          onLeave={handleLeave}
          onlineMembers={onlineMembers}
        />
      )}

      {/* Main Content */}
      <Layout.Content
        style={{
          marginLeft: 250,
          marginTop: '64px',
          background: '#f5f5f5',
          minHeight: 'calc(100vh - 128px)',
          overflowY: 'auto',
        }}
      >
        {loading ? <Spin /> : renderContent()}
      </Layout.Content>

      {/* Invite Modal */}
      {group && (
        <InviteMemberModal
          visible={inviteModalVisible}
          groupId={Number(groupId)}
          onClose={() => setInviteModalVisible(false)}
          onSuccess={() => {
            loadMembers();
            setInviteModalVisible(false);
          }}
        />
      )}
    </Layout>
  );
};
