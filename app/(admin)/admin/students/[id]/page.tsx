'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Descriptions, Tag, Avatar, Tabs, Typography,
  Button, Empty, Modal, Form, Input, InputNumber, Select, Row, Col, message, Space,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Student, ClassStudent, Attendance } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';
import SharedTable from '@/components/SharedTable';

const { Title, Text } = Typography;

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassStudent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();

  const router = useRouter();

  const loadData = async () => {
    const { id } = await params;
    try {
      const res = await fetch(`/api/admin/students/${id}`);
      const data = await res.json();
      setStudent(data.student);
      setClasses(data.classes ?? []);
      setAttendance(data.attendance ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params]);

  const handleOpenEdit = () => {
    if (!student) return;
    editForm.setFieldsValue({
      name: student.name,
      student_code: student.student_code,
      email: student.email,
      department: student.department || '',
      semester: student.semester ?? undefined,
      section: student.section || '',
      status: student.status,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!student) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        message.success(`Student profile updated!`);
        setStudent(data.student);
        setEditOpen(false);
      } else {
        message.error(data.error || 'Failed to update student');
      }
    } catch {
      message.error('An error occurred while updating student');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteStudent = () => {
    if (!student) return;
    Modal.confirm({
      title: 'Delete Student',
      icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
      content: (
        <div>
          <p style={{ margin: 0, color: '#111111' }}>
            Are you sure you want to delete <strong>{student.name}</strong> ({student.student_code})?
          </p>
          <p style={{ marginTop: 8, color: '#6B6B6B', fontSize: 13 }}>
            This will permanently remove the student from enrolled classes and delete their attendance records.
          </p>
        </div>
      ),
      okText: 'Delete Student',
      okType: 'danger',
      cancelText: 'Cancel',
      okButtonProps: { style: { borderRadius: 0, fontWeight: 600 } },
      cancelButtonProps: { style: { borderRadius: 0 } },
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/students/${student.id}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (res.ok) {
            message.success(`Student ${student.name} deleted successfully`);
            router.push('/admin/students');
          } else {
            message.error(data.error || 'Failed to delete student');
          }
        } catch {
          message.error('An error occurred while deleting student');
        }
      },
    });
  };

  if (loading) {
    return (
      <AntdConfigProvider>
        <StylishLoader
          message="Loading student profile..."
          submessage="Retrieving enrolled courses and attendance history"
        />
      </AntdConfigProvider>
    );
  }
  if (!student) return <Empty description="Student not found" />;

  const attendanceColumns = [
    {
      title: 'Class',
      key: 'class',
      width: 220,
      render: (_: any, a: Attendance) => (
        <span style={{ color: '#111111', fontWeight: 500 }}>{(a.session as any)?.class?.name ?? '—'}</span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'marked_at',
      width: 180,
      render: (val: string) => <span style={{ color: '#111111' }}>{dayjs(val).format('MMM D, YYYY h:mm A')}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (s: string) => (
        <Tag color="success" style={{ borderRadius: 0, fontWeight: 600 }}>{s.toUpperCase()}</Tag>
      ),
    },
  ];

  const classColumns = [
    {
      title: 'Class',
      key: 'class',
      width: 220,
      render: (_: any, cs: ClassStudent) => (
        <div>
          <div style={{ color: '#111111', fontWeight: 600 }}>{cs.class?.name}</div>
          <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>{cs.class?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Department',
      width: 150,
      render: (_: any, cs: ClassStudent) => <span style={{ color: '#6B6B6B' }}>{cs.class?.department ?? '—'}</span>,
    },
    {
      title: 'Assigned Date',
      dataIndex: 'created_at',
      width: 140,
      render: (val: string) => <span style={{ color: '#6B6B6B' }}>{dayjs(val).format('MMM D, YYYY')}</span>,
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/admin/students')}
          style={{ color: '#6B6B6B', marginBottom: 16, padding: 0 }}
        >
          Back to Students
        </Button>

        {/* Profile card */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            marginBottom: 20,
          }}
          styles={{ body: { padding: 24 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar
                size={56}
                style={{ background: '#2563EB', color: '#FFFFFF', fontSize: 22, fontWeight: 700, borderRadius: 0 }}
              >
                {student.name.charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <Title level={3} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>{student.name}</Title>
                <Text type="secondary" style={{ color: '#6B6B6B' }}>{student.student_code}</Text>
                <div style={{ marginTop: 6 }}>
                  <Tag
                    color={student.status === 'active' ? 'success' : 'default'}
                    style={{ borderRadius: 0, fontWeight: 600 }}
                  >
                    {student.status.toUpperCase()}
                  </Tag>
                </div>
              </div>
            </div>

            <Space size={10} wrap>
              <Button
                icon={<EditOutlined />}
                onClick={handleOpenEdit}
                style={{ borderRadius: 0, fontWeight: 500, height: 36 }}
              >
                Edit Profile
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteStudent}
                style={{ borderRadius: 0, fontWeight: 500, height: 36 }}
              >
                Delete Student
              </Button>
            </Space>
          </div>

          <Descriptions
            column={{ xs: 1, sm: 2, md: 3 }}
            styles={{ label: { color: '#6B6B6B' }, content: { color: '#111111', fontWeight: 500 } }}
          >
            <Descriptions.Item label="Email">{student.email}</Descriptions.Item>
            <Descriptions.Item label="Department">{student.department ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Semester">{student.semester ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{student.section ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Joined">{dayjs(student.created_at).format('MMMM D, YYYY')}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Tabs */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Tabs
            defaultActiveKey="classes"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'classes',
                label: `Classes (${classes.length})`,
                children: (
                  <div style={{ padding: '0 0 16px', overflowX: 'auto' }}>
                    <SharedTable
                      dataSource={classes}
                      columns={classColumns}
                      rowKey="id"
                      scroll={{ x: 550 }}
                      pagination={false}
                      locale={{ emptyText: 'Not assigned to any classes' }}
                    />
                  </div>
                ),
              },
              {
                key: 'attendance',
                label: `Attendance (${attendance.length})`,
                children: (
                  <div style={{ padding: '0 0 16px', overflowX: 'auto' }}>
                    <SharedTable
                      dataSource={attendance}
                      columns={attendanceColumns}
                      rowKey="id"
                      scroll={{ x: 550 }}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      locale={{ emptyText: 'No attendance records' }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>

        {/* Edit Student Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 0,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                }}
              >
                <EditOutlined style={{ fontSize: 16 }} />
              </div>
              <div>
                <Text strong style={{ color: '#111111', fontSize: 16, display: 'block' }}>
                  Edit Student Profile
                </Text>
                <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>
                  Update student records and enrollment information
                </Text>
              </div>
            </div>
          }
          open={editOpen}
          onCancel={() => {
            setEditOpen(false);
            editForm.resetFields();
          }}
          footer={null}
          width={580}
          styles={{ body: { background: '#FFFFFF' }, header: { background: '#FFFFFF' } }}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditSubmit}
            style={{ marginTop: 20 }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ color: '#111111', fontWeight: 500 }}>Student Code / ID</span>}
                  name="student_code"
                  rules={[{ required: true, message: 'Student code is required' }]}
                >
                  <Input placeholder="e.g. STU001" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ color: '#111111', fontWeight: 500 }}>Full Name</span>}
                  name="name"
                  rules={[{ required: true, message: 'Student name is required' }]}
                >
                  <Input placeholder="e.g. John Doe" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={16}>
                <Form.Item
                  label={<span style={{ color: '#111111', fontWeight: 500 }}>Email Address</span>}
                  name="email"
                  rules={[
                    { required: true, message: 'Email is required' },
                    { type: 'email', message: 'Enter a valid email' },
                  ]}
                >
                  <Input placeholder="e.g. john.doe@university.edu" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label={<span style={{ color: '#111111', fontWeight: 500 }}>Account Status</span>}
                  name="status"
                  rules={[{ required: true }]}
                >
                  <Select style={{ height: 38, width: '100%' }}>
                    <Select.Option value="active">Active</Select.Option>
                    <Select.Option value="inactive">Inactive</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#111111', fontWeight: 500 }}>Department</span>} name="department">
                  <Input placeholder="e.g. CSE" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#111111', fontWeight: 500 }}>Semester</span>} name="semester">
                  <InputNumber min={1} max={12} style={{ width: '100%', borderRadius: 0, height: 38, paddingTop: 4 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#111111', fontWeight: 500 }}>Section</span>} name="section">
                  <Input placeholder="e.g. A" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button
                onClick={() => {
                  setEditOpen(false);
                  editForm.resetFields();
                }}
                style={{ height: 38, borderRadius: 0 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={editLoading}
                style={{
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  borderRadius: 0,
                  fontWeight: 600,
                  height: 38,
                  padding: '0 24px',
                }}
              >
                Save Changes
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}
